#target photoshop
// I am using 'JSON in JavaScript' for formatting the data http://www.json.org/js.html
#include "utils/json2.js"


// Add trim function because it isn't included
// Source: https://stackoverflow.com/questions/498970/trim-string-in-javascript
if (!String.prototype.trim) {
	(function() {
		// Make sure we trim BOM and NBSP
		var rtrim = /^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g;
		String.prototype.trim = function() {
			return this.replace(rtrim, '');
		};
	})();
}


var plugin = {
	path: "...",
	json: {},
	run: function() {

		var export_folder = Folder.selectDialog("Select a folder to export to");
		if (export_folder) {
			plugin.path = export_folder + "/";
			//alert(export_folder.path);
			//return;


			plugin.json = {};

			// Do all our processing in a duplicate object so we don't overwrite anything important
			plugin.doc = app.activeDocument.duplicate();

			/*
			if (plugin.doc.width > 1920 || plugin.doc.height > 1080) {
				alert("Warning: This document might be too large for most displays.");
			}
			*/

			// Make sure path ends with backslash
			if (plugin.path.substr(-1) != "\\") {
				plugin.path = plugin.path + "\\";
			}

			plugin.setup_viewport();

			plugin.process_planes();


			// Close our duplicated document without saving changes
			plugin.doc.close(SaveOptions.DONOTSAVECHANGES);


			alert("Done!");
			//alert(JSON.stringify(plugin.json, null, "\t"));
			//alert(plugin.format_json(plugin.json));
		}

	},
	setup_viewport: function() {
		plugin.json.viewport = {
			width: parseInt(plugin.doc.width),
			height: parseInt(plugin.doc.height),
			x_mul: 1,
			y_mul: 1
		};
	},
	process_planes: function() {
		var default_plane = {
			d: 0,		// Depth (for depth of field)
			o: 0,		// Offset
			f: "png",	// Filetype: png (or jpg)
			q: 8,		// Quality (For jpg files)
		};
		plugin.json.planes = [];

		// Hide all planes
		for (var i=0; i<plugin.doc.layers.length; i++) {
			plugin.doc.layers[i].visible = false;
		}

		// For hiding/showing
		var last_layer = plugin.doc.layers[0];

		// Now process each plane

		for (var i=0; i<plugin.doc.layers.length; i++) {

			var layer = plugin.doc.layers[i];
			var layer_params = plugin.parse_params(layer.name); // Extract parameters from group name
			var plane = {};

			// Apply default settings to our parsed object
			plugin.extend(layer_params, default_plane);

			// For the purposes of exporting, every plane is the same width as the document.
			plane.width = parseInt(plugin.doc.width);
			plane.height = parseInt(plugin.doc.height);
			plane.offset = parseInt(layer_params.params.o);
			plane.depth = parseInt(layer_params.params.d);
			plane.name = plugin.unique_name(layer_params.name, plugin.json.planes);
			plane.elements = [];

			// Make last layer invisible and this layer visible
			last_layer.visible = false;
			layer.visible = true;


			// For hiding/showing elements
			var last_element = layer.layers[0];


			// Hide all elements
			for (var e=0;e<layer.layers.length;e++) {
				layer.layers[e].visible = false;
			}			

			// Now process all the elements within this plane
			for (var e=0;e<layer.layers.length;e++) {
				var element_layer = layer.layers[e];
				var element_params = plugin.parse_params(element_layer.name); // Extract parameters from element name
				var element = {};

				// Inherit settings from our layer
				plugin.extend(layer_params, element_params);

				// Make last layer invisible and this layer visible
				last_element.visible = false;
				element_layer.visible = true;

				// Get element bounds
				var b = element_layer.bounds;
				element.x = parseInt(b[0]);
				element.y = parseInt(b[1]);
				element.width = parseInt(b[2]) - parseInt(b[0]);
				element.height = parseInt(b[3]) - parseInt(b[1]);

				element.name = plugin.unique_name(element_params.name, plane.elements);
				element.type = "img";


				// Copy to another image so we can save it
				var new_doc = plugin.copy_element_to_new_doc(plugin.doc, element);

				// What format are we using?
				switch (element_params.f) {
					case "jpg":
						element.src = plane.name + "-" + element_params.name + ".jpg";
						plugin.save_jpg(new_doc, plugin.path + element.src, element_params.q);
						break;
					case "png":
						default:
						element.src = plane.name + "-" + element_params.name + ".png";
						plugin.save_png(new_doc, plugin.path + element.src);
						break;
				}

				// Close the new document without saving changes
				new_doc.close(SaveOptions.DONOTSAVECHANGES);
				
				plane.elements.push(element);

				// So we can hide this element next time
				last_element = element_layer;
			}



			// Save this plane.
			plugin.json.planes.push(plane);

			// So we can hide this layer next time
			last_layer = layer;
		}

		plugin.save_json(plugin.path + "aperture.json");
	},
	process_elements: function() {

	},
	copy_element_to_new_doc: function(doc, element_params) {
		doc.selection.selectAll();
		doc.selection.copy(true);

		var new_document = app.documents.add(element_params.width, element_params.height, 72, "Aperture Element");
		new_document.paste();
		new_document.layers[1].visible = false; // hide the background image

		//new_document.trim(TrimType.TRANSPARENT);
		//doc.selection.deselect();

		return new_document;
	},
	create_selection: function(doc, x, y, width, height) {
		var square = [[x,y], [x,y+height], [x+width,y+height], [x+width,y]];
		doc.selection.select(square);
	},
	save_json: function(filename) {
		var full_filename = File(filename);

		// Delete the file if it already exists
		if (full_filename.exists) full_filename.remove();

		// Convert our json object into a string
		var data = JSON.stringify(plugin.json, null, "\t");

		// Now save the file and close it
		full_filename.encoding = "UTF8";
		full_filename.open("e", "TEXT", "????");
		full_filename.writeln(data);
		full_filename.close();
	},
	save_jpg: function(doc, filename, quality) {
		var img_options = new JPEGSaveOptions();
		saveOptions.embedColorProfile = true;
		//saveOptions.formatOptions = FormatOptions.STANDARDBASELINE;
		//saveOptions.matte = MatteType.NONE;
		saveOptions.quality = quality;

		var img_file = new File(filename);
		doc.saveAs(img_file, img_options, true, Extension.LOWERCASE); 
	},
	save_png: function(doc, filename) { 
		var img_options = new PNGSaveOptions(); 

		var img_file = new File(filename);
		doc.saveAs(img_file, img_options, true, Extension.LOWERCASE); 
	},

	// Slightly modified
	// https://stackoverflow.com/questions/12317003/something-like-jquery-extend-but-standalone
	extend: function(target, source) {
		target = target || {};
		for (var prop in source) {
			if (typeof source[prop] === 'object') {
				target[prop] = plugin.extend(target[prop], source[prop]);
			} else {
				target[prop] = source[prop];
			}
		}
		return target;
	},

	// TO DO: Ensure plane name is unique so we don't overwrite things
	unique_name: function(n, in_object) {
		// Find n in_object
		if (typeof in_object[n] !== "undefined") {
			// Object exists. return new name.
		}
		return n;
	},
	parse_params: function(layer_name) {
		var params_start = layer_name.indexOf("[");
		var params_end = layer_name.indexOf("]");

		var json_obj = {};
		json_obj.params = {};
		if (params_start > -1 && params_end > params_start) {
			json_obj.name = layer_name.substr(0, params_start).trim();
			var params_block = layer_name.substr(params_start+1, params_end-params_start-1);

			// Parse out parameters. Key/Val pair separated by colon. Each pair separated by semicolon. Format: [key1:val1; key2:val2]
			var bits = params_block.split(";");
			for (var bi=0;bi<bits.length;bi++) {
				var temp = bits[bi].split(":", 2);

				json_obj.params[temp[0]] = temp[1];
			}
		}
		else {
			// Assume everything is flat. Weird.
			json_obj.name = layer_name;
		}
		return json_obj;
	}
};
plugin.run();
