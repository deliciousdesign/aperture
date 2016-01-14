/* ====================================================================
 Aperture Animation Library
 
 More info at:
 http://getbacon.net/javascript/aperture
==================================================================== */
var aperture = function($) {
	// Objects by name. All names are unique in the context of the viewport.
	var obj = {
		viewports: [],
		suspended: false,

		load_json: function(json) {
			var result = {};
			result.json = json;

			viewport.width = json.viewport.width;
			viewport.height = json.viewport.height;
			viewport.y_effect = 0;

			// Create planes
			result.planes = [];
			//for (var plane_name in json.planes) {
			for (var i=json.planes.length-1;i>=0;i--) {
				var plane_desc = json.planes[i];
				var plane_obj = viewport.create_plane(plane_desc.name);

				plane_obj.width = plane_desc.width;
				plane_obj.height = plane_desc.height;
				plane_obj.offset = plane_desc.offset;

				// Create elements within plane
				for (var el_name in plane_desc.elements) {
					var el = plane_desc.elements[el_name];
					var el_settings = {
						rect: [el.x, el.y, el.width, el.height], 
						src:"test/" + el.src, 
						type: "img"
					};
					var el = plane_obj.load_element(el_settings);
				}

				// Store our plane
				// TO DO: Determine if saving as array is a better choice
				result.planes.push(plane_obj);
			}

			aperture.event_resize();			
		},

		// Creates a viewport from a div
		// Usage aperture.create_viewport("#viewport");
		create_viewport: function(el, options) {
			var indexes = {};
			var vp = {
				has_document: true, // false = not attached to <body> tag anymore
				element: $(el),
				planes: [],
				suspended: false,
				height: 0,
				width: 0,
				scale: 1,
				scaleheight: 0,
				scalewidth: 0,
				transform_type: "",
				y_mul: 0.15, // Multiply Y by... Good for slowing down the Y axis. Set to 1 for no effect. 

				// Alters how fast plane moves by axis e.g. 0=no movement, .5=half movement, 1=full movement, etc
				x_effect: 1,
				y_effect: 1,

				// Variables for shifting perspective
				shift: {
					rot_y: 0,
					pos_x: 0,
					pos_y: 0,
					mouse_on: false,
					mouse_x: 0,
					mouse_y: 0,
					accel_on: false,
					accel_x: 0,
					accel_y: 0,
					accel_z: 0
				},

				/* ==============================================
				   Public Methods
				============================================== */
				load_json: function(url) {

				},
				create_plane: function(name, options) {
					// Only create plane if it doesn't exist
					if (typeof indexes[name] === "undefined") {
						var plane = {
							width: 0,
							height: 0,
							depth: 0,
							offset: 0,
							translate: {x:0, y:0, rot: 0},
							element: {},
							elements: [],
							load_element: function(options) {
								var el = {};
								el.src = options.src;
								el.type = options.type;
								el.rect = {x:0,y:0,w:0,h:0};
								el.translate = {x:0, y:0, rot: 0};
								el.last_translate = {x:-9999.1234, y:-99999.1234, rot: -999990};
								el.hidden = options.hidden;

								switch (options.type) {
									case "svg":
										break;
									case "vid":
										break;
									default:
									case "img":
										el.element = $("<img>");
										el.element.attr("src", el.src);
										//el.element.data("obj", el);

										// Add DOM element
										plane.element.append(el.element);

										// Add to list of elements
										plane.elements.push(el);

										// TO DO: Add to indexes
										if (typeof options.name === "string") {
											indexes[options.name] = el;
										}

										if (typeof options.rect === "undefined") {

											if (typeof options.pos !== "undefined") {
												el.rect.x = options.pos[0];
												el.rect.y = options.pos[1];
											}

											el.element.load(function() {

												// Clear height/width to get native size
												el.element.css("width", "");
												el.element.css("height", "");
												el.rect.w = el.element.width();
												el.rect.h = el.element.height();
												el.rescale();
											});
										}
										else {
											el.rect.x = options.rect[0];
											el.rect.y = options.rect[1];
											el.rect.w = options.rect[2];
											el.rect.h = options.rect[3];
										}

										// This func is called to reposition the element without resizing
										el.repos = function() {
											el.element.css("left", (vp.scale * el.rect.x) + "px");
											el.element.css("top", (vp.scale * el.rect.y) + "px");
										};
										el.trans3d = function() {
											// Don't set if unchanged
											if (el.last_translate.x != el.translate.x ||
												el.last_translate.y != el.translate.y ||
												el.last_translate.rot != el.translate.rot) {

												// Pos is different. Set.
												aperture.transform(el.element[0],"translate3d(" + (el.translate.x * vp.scale) + "px, " + (el.translate.y*vp.scale) + "px, 0px)  rotateZ(" + el.translate.rot + "deg)");

												// Store position for next trans3d call
												el.last_translate.x = el.translate.x;
												el.last_translate.y = el.translate.y;
												el.last_translate.rot = el.translate.rot;
											}
										};
										// This func is called whenever the window resizes
										el.rescale = function() {
											var el = this;

											// Reposition
											el.repos();

											// Resize object
											el.element.width(vp.scale * el.rect.w);
											el.element.height(vp.scale * el.rect.h);
										};
										break;
								}
								el.rescale();
								el.trans3d();


								return el;
							},
							rescale: function(ignore_children) {
								plane.scale_offset_x = vp.scale * plane.offset * vp.x_effect;
								plane.scale_offset_y = vp.scale * plane.offset * vp.y_effect;

								// Rescale children?
								if (typeof ignore_children === "undefined" || ignore_children == false) {
									for (var e=0; e<plane.elements.length; e++) {
										plane.elements[e].rescale();
									}
								}
							}
						};

						// Merge our settings
						$.extend(plane, options);

						plane.element = $('<div class="plane"></div>');
						vp.element.append(plane.element);

						vp.planes.push(plane);
						indexes[name] = plane;
						return plane;
					}
					else {
						return false;
					}
				},
				get_element: function(name) {
					if (typeof indexes[name] === "undefined") {return;}
					return indexes[name].element;
				},
				stop: function() {
					vp.suspend();
					vp.planes = [];
					vp.element.empty();
				},

				// plane = name or plane object
				focus_on_plane: function(plane, multiplier) {
					// Current plane depth is normalized to 0 depth
					// All other planes are blurred based on distance from current plane depth
					// multiplier exaggerates or minimizes the depth of field effect

					// Apply blur
					var origin = 0; // TO DO: get from plane
					for (var p=0; p<vp.planes.length; p++) {
						var plane = vp.planes[p];
						var amount = Math.abs(plane.depth - origin) * .05;
						if (amount > 0) {
							//plane.element.css("-webkit-filter", "blur(" + amount + "px)");
							//plane.element.css("filter", "blur(" + amount + "px)");
						}
						else {
							//plane.element.css("-webkit-filter", "");
							//plane.element.css("filter", "");
						}
					}
				},


				/* ==============================================
				   Events
				============================================== */
				event_mousemove: function(e) {
					// Cancel if animations are suspended
					if (vp.suspended==true) { return; }

					vp.shift.mouse_on = true;

					if (vp.scalewidth > 0 && vp.scaleheight > 0) {
						vp.shift.mouse_x = e.pageX/vp.scalewidth;
						vp.shift.mouse_y = e.pageY/vp.scaleheight;

						// Low pass filter mouse movement by 10%
						var alpha = 0.1;
						vp.shift.pos_x = vp.shift.mouse_x * alpha + (vp.shift.pos_x * (1.0 - alpha));
						vp.shift.pos_y = vp.shift.mouse_y * alpha + (vp.shift.pos_y * (1.0 - alpha));
					}
				},
				event_devicemotion: function(event) {  
					
					// Cancel if animations are suspended
					if (vp.suspended==true) { return; }
					if (typeof event.accelerationIncludingGravity.x === "object") {return;}
					if (typeof event.accelerationIncludingGravity.y === "object") {return;}
					if (typeof event.accelerationIncludingGravity.z === "object") {return;}

					// Turns on accelerometer
					vp.shift.accel_on = true;

					// Low pass filter accelerometer data by 30%
					var alpha = 0.3;
					vp.shift.accel_x = event.accelerationIncludingGravity.x;
					vp.shift.accel_y = event.accelerationIncludingGravity.y;
					vp.shift.accel_z = event.accelerationIncludingGravity.z;

					// Compatible values with mouse_x and mouse_y.
					// Data is usually value between 0 and 10....on Earth. (9.8 m/s). Divide by 5 (or *.2)
					switch (window.orientation) {
						case -90:
							vp.shift.accel_tilt_x = vp.shift.accel_y * .1;
							vp.shift.accel_tilt_y = vp.shift.accel_x * .1;
							break;
						case 0:
							vp.shift.accel_tilt_x = vp.shift.accel_x * .1;
							vp.shift.accel_tilt_y = vp.shift.accel_y * .1;
							break;
						case 90:
							vp.shift.accel_tilt_x = vp.shift.accel_y * .1;
							vp.shift.accel_tilt_y = vp.shift.accel_x * .1;
							break;
						case 180:
							vp.shift.accel_tilt_x = -vp.shift.accel_x * .1;
							vp.shift.accel_tilt_y = -vp.shift.accel_y * .1;
							break;
						default:
							//Invalid
							break;
					}

					// Low pass filter accelerometer data by 30%
					var alpha = 0.3;
					vp.shift.pos_x = vp.shift.accel_tilt_x * alpha + (vp.shift.pos_x * (1.0 - alpha));
					vp.shift.pos_y = vp.shift.accel_tilt_y * alpha + (vp.shift.pos_y * (1.0 - alpha));
					return;
				},
				event_resize: function () {
					// TO DO: redraw buffer: static elements & elements with effects


					// Resize viewport
					vp.element.height((vp.height / vp.width) * vp.element.width());
					vp.scale = vp.element.width() / vp.width;
					vp.scalewidth = vp.scale * vp.width;
					vp.scaleheight = vp.scale * vp.height;


					// Rescale the whole scene
					for (var p=0; p<vp.planes.length; p++) {
						vp.planes[p].rescale();
					}
				},



				// Function is called once every frame by HTML5
				event_animate: function(timestamp) {
					// Cancel if animations are suspended
					if (vp.suspended==true) { return; }

					for (var p=0; p<vp.planes.length; p++) {
						var plane = vp.planes[p];
						var pos_x = 0;
						var pos_y = 0;

						// Move the plane differently for mouse vs tilt
						if (vp.shift.mouse_on) {
							pos_x = -vp.shift.pos_x * plane.scale_offset_x + (plane.scale_offset_x / 2);
							pos_y = -vp.shift.pos_y * (plane.scale_offset_y * vp.y_mul) + (plane.scale_offset_y / 2);
						}
						else {
							pos_x = -vp.shift.pos_x * plane.scale_offset_x + (plane.scale_offset_x / 2);
							pos_y = -vp.shift.pos_y * plane.scale_offset_y + (plane.scale_offset_y / 2);
						}

						//plane.element.css("transform", "translate3d(" + pos_x + "px, " + pos_y + "px, 0px)  rotateY(" + vp.shift.rot_y + "deg)");
						aperture.transform(plane.element[0], "translate3d(" + pos_x + "px, " + pos_y + "px, 0px)  rotateY(" + vp.shift.rot_y + "deg)");

						// Reposition elements inside plane
						for (i=0;i<plane.elements.length;i++) {
							plane.elements[i].trans3d();
						}
					}
				},
				suspend: function() {
					vp.suspended = true;
				},
				resume: function() {
					vp.suspended = false;
				},

				init: function() {
					// Clear the viewport and setup the class
					vp.element.empty();
					vp.element.addClass("aperture-viewport");

					// Regular events
					//$(window).resize(vp.event_resize);
					//window.setTimeout(function() { $(window).resize(); }, 50); // trigger resize a little after
				}
			};

			// Copy our settings
			$.extend(vp, options);

			vp.init();

			// Calls the viewport to rescale everything for the first time
			vp.event_resize();

			aperture.viewports.push(vp);

			return vp;
		},

		// Remember to use the direct element. Not jQuery.
		transform: function(el, transform) {
			// This uses the detected transform_type found in the supports3d() function
			//plane.element.css(aperture.transform_type, transform);
			el.style[aperture.transform_type] = transform;
		},
		supports3d:function() {
			var has3d;

			// Left side is direct : Right side is CSS
			var	transforms = {
				'webkitTransform':'-webkit-transform',
				'OTransform':'-o-transform',
				'msTransform':'-ms-transform',
				'MozTransform':'-moz-transform',
				'transform':'transform'
			};
			var transform_method = false;

			// Add temporary element to get the computed style.
			var el = document.createElement('p');
			document.body.insertBefore(el, null);

			// Loop through each transform. 
			// Start with the beta methods and attempt standardized method after
			for (var t in transforms) {
				if (el.style[t] !== undefined) {

					// Attempt to translate our element
					el.style[t] = "translate3d(1px,2px,3px)";
					has3d = window.getComputedStyle(el).getPropertyValue(transforms[t]);
					if (has3d) {
						transform_method = t;
					}

				}
			}

			// Remove our temporary element
			document.body.removeChild(el);

			//return (has3d !== undefined && has3d.length > 0 && has3d !== "none");
			if (has3d) {
				return transform_method;
			}
			else {
				return false;
			}
		},
		init: function() {
			// Check if we support 3D
			obj.transform_type = obj.supports3d();

			// Hook all the standard events so we can route them to our viewports
			$("body").mousemove(obj.event_mousemove);
			window.ondevicemotion = obj.event_devicemotion;
			$(window).resize(obj.event_resize);

			// Begin.
			obj.start_animation_loop();

			// Check if our viewports are still active
			if (typeof bacon !== "undefined") {
				bacon.always.on("ready", function() {
					//aperture.event_resize();
					for (var i=aperture.viewports.length-1; i>=0;i--) {
						if (aperture.viewports[i].element.parents().find("body").length <= 0) {
							aperture.viewports[i].has_document = false; // This means its no longer attached to the body
							aperture.viewports.splice(i, 1); // Remove the dead element
						}
					}
				});
			}
		},

		// These are the master events which are passed to each viewport
		event_mousemove: function(ev) {
			for (var i=0; i<obj.viewports.length; i++) {
				obj.viewports[i].event_mousemove(ev);
			}
		},
		event_devicemotion: function(ev) {
			for (var i=0; i<obj.viewports.length; i++) {
				obj.viewports[i].event_devicemotion(ev);
			}
		},
		event_resize: function () {
			for (var i=0; i<obj.viewports.length; i++) {
				obj.viewports[i].event_resize();
			}
		},
		event_animate: function(timestamp) {
			if (obj.suspended) return;

			for (var i=0; i<obj.viewports.length; i++) {
				obj.viewports[i].event_animate(timestamp);
			}

			// Continue animating
			window.requestAnimFrame_aperture(obj.event_animate);			
		},

		suspend: function() {
			obj.suspended = true;
		},
		resume: function() {
			obj.suspended = false;
			window.requestAnimFrame_aperture(obj.event_animate);
		},
		start_animation_loop: function() {
			window.requestAnimFrame_aperture=function(){
				return window.requestAnimationFrame||window.webkitRequestAnimationFrame||window.mozRequestAnimationFrame||window.oRequestAnimationFrame||window.msRequestAnimationFrame||function(a){window.setTimeout(a,1E3/30);};
			}();
			obj.resume();
		},
	};

	if (typeof bacon !== "undefined") {
		bacon.page.on("ready", function() {
			obj.init();
		});

		// This is called after a "load" instead of ready because most page loads will hide content via "display:none". 
		// We need to resize objects once they are visible and "load" comes after the page has loaded
		bacon.always.on("load", function() {
			aperture.event_resize();
		});
	}
	else {
		$(document).ready(function() {
			obj.init();
		});
		
		obj.event_resize();
	}
	return obj;
}(jQuery);




// TO DO: Lots going on here that might not be needed for this library. Clean this up.
(function (window) {
	window.viewportSize = {};

	window.viewportSize.getHeight = function () {
		return getSize("Height");
	};

	window.viewportSize.getWidth = function () {
		return getSize("Width");
	};

	var getSize = function (Name) {
		var size;
		var name = Name.toLowerCase();
		var document = window.document;
		var documentElement = document.documentElement;
		if (window["inner" + Name] === undefined) {
			// IE6 & IE7 don't have window.innerWidth or innerHeight
			size = documentElement["client" + Name];
		}
		else if (window["inner" + Name] != documentElement["client" + Name]) {
			// WebKit doesn't include scrollbars while calculating viewport size so we have to get fancy

			// Insert markup to test if a media query will match document.doumentElement["client" + Name]
			var bodyElement = document.createElement("body");
			bodyElement.id = "vpw-test-b";
			bodyElement.style.cssText = "overflow:scroll";
			var divElement = document.createElement("div");
			divElement.id = "vpw-test-d";
			divElement.style.cssText = "position:absolute;top:-1000px";
			// Getting specific on the CSS selector so it won't get overridden easily
			divElement.innerHTML = "<style>@media(" + name + ":" + documentElement["client" + Name] + "px){body#vpw-test-b div#vpw-test-d{" + name + ":7px!important}}</style>";
			bodyElement.appendChild(divElement);
			documentElement.insertBefore(bodyElement, document.head);

			if (divElement["offset" + Name] == 7) {
				// Media query matches document.documentElement["client" + Name]
				size = documentElement["client" + Name];
			}
			else {
				// Media query didn't match, use window["inner" + Name]
				size = window["inner" + Name];
			}
			// Cleanup
			documentElement.removeChild(bodyElement);
		}
		else {
			// Default to use window["inner" + Name]
			size = window["inner" + Name];
		}
		return size;
	};

})(this);
