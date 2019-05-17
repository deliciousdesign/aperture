/* ====================================================================
 Aperture - A fast DOM Animation Library
 Built by Tim
==================================================================== */
var aperture = function($) {
	// Objects by name. All names are unique in the context of the viewport.
	var obj = {
		viewports: [],
		suspended: false,

		// Shortcuts for transforming CSS positions formerly 'transform_type'
		css_shortcuts: {
			transform: "",
			transform_origin: ""
		},
		has3d: false,

		element_plugins: {},


		// See for usage and info: 
		// http://www.zankavtaskin.com/2016/05/jquery-chaining-animations-with.html
		animation_chain: function() {
			var obj = {};
			
			obj.chainIndex = 0;
			obj.chainList = [];
			obj.onComplete = function () { };
							 
			obj.Add = function (funcToComplete) {
				var myself = obj;
				obj.chainList.push(function () {
					funcToComplete(function () {
						myself.chainIndex++;
						myself.execNextFuncInTheChain(myself.chainIndex);
					});
		 
				});
				return myself;
			}
		 
			obj.Run = function (onComplete) {
				if (onComplete != null)
					obj.onComplete = onComplete;
		 
				obj.execNextFuncInTheChain(0);
			}
		 
			obj.execNextFuncInTheChain = function (index) {
				if (obj.chainList[index] != null) {
					obj.chainList[index]();
				} else {
					obj.onComplete();
				}
			}
		 
			return obj;
		},


		preload: function(images, progress_callback) {
			var pl_obj = {
				images: [],
				images_loaded: 0,
				complete: false,
				check: function() {
					if (pl_obj.images_loaded >= pl_obj.images.length - 1) {
						// Loop through and verify load completion?

						// Preload complete
						pl_obj.complete = true;
					}
					progress_callback(pl_obj);
				}
			};
			for (i=0;i<images.length;i++) {
				var img = new Image();
				img.onload = function() {
					this.loaded = true;
					pl_obj.images_loaded++;
					pl_obj.check();
				};
				img.src = images[i];
				pl_obj.images.push(img);
			}

			return pl_obj;
		},

		// Creates a viewport from a div
		// Usage aperture.create_viewport("#viewport");
		create_viewport: function(el, options) {
			var vp = {
				plane_indexes: {},
				has_document: true, // false = not attached to <body> tag anymore
				element: $(el),
				img_preload_list: [],
				planes: [],
				suspended: true,
				height: 0,
				width: 0,
				scale_offset: 1, // This is used to make the image bigger or smaller than the original spec
				x_offset: 0,
				y_offset: 0,
				auto_scale: 1,
				scaleheight: 0,
				scalewidth: 0,

				y_mul: 0.15, // Multiply Y by... Good for slowing down the Y axis. Set to 1 for no effect. 

				perspective_type: "default", 	// This is how we control the perspective. default = mouse/accelerometer
												// can be default, scroll, manual = no control
				perspective_scroll_axis: "y", // Defaults to y axis

				// Alters how fast plane moves by axis e.g. 0=no movement, .5=half movement, 1=full movement, etc
				x_effect: 1,
				y_effect: 1,
				z_effect: 1,

				// Variables for shifting perspective
				shift: {
					rot_y: 0,
					pos_x: 0,
					pos_y: 0,
					pos_z: 0,
					mouse_on: false,
					mouse_x: 0,
					mouse_y: 0,
					accel_on: false,
					devicemotion_on: false,
					gravity_on: false,
					accel_x: 0,
					accel_y: 0,
					accel_z: 0,
					o_alpha: 0,
					o_beta: 0,
					o_gamma: 0,
					o_max: 0
				},

				/* ==============================================
				   Public Methods
				============================================== */

				get_json: function(url, callback) {
					$.post(url, {}, function(json) {
						var base_url = url.substring(0, url.lastIndexOf("/")) + "/";
						vp.load_json_obj(base_url, json);

						if (typeof callback === "function") { callback(); }
					});
				},
				load_json_obj: function(base_url, json) {

					var result = {};
					result.json = json;

					var viewport = vp;
					viewport.width = json.viewport.width;
					viewport.height = json.viewport.height;
					if (typeof json.viewport.y_mul !== "undefined" ) { viewport.y_mul = json.viewport.y_mul; }
					if (typeof json.viewport.scale_offset !== "undefined" ) { viewport.scale_offset = json.viewport.scale_offset; }
					if (typeof json.viewport.x_offset !== "undefined" ) { viewport.x_offset = json.viewport.x_offset; }
					if (typeof json.viewport.y_offset !== "undefined" ) { viewport.y_offset = json.viewport.y_offset; }
					if (typeof json.viewport.z_offset !== "undefined" ) { viewport.z_offset = json.viewport.z_offset; }
					if (typeof json.viewport.perspective_type !== "undefined" ) { viewport.perspective_type = json.viewport.perspective_type; }
					if (typeof json.viewport.perspective_scroll_axis !== "undefined" ) { viewport.perspective_scroll_axis = json.viewport.perspective_scroll_axis; }

					// Create planes
					result.planes = [];

					//for (var plane_name in json.planes) {
					for (var i=json.planes.length-1; i>=0; i--) {
						var plane_desc = json.planes[i];
						var plane_obj = viewport.create_plane(plane_desc.name, {base_url:base_url});

						plane_obj.width = plane_desc.width;
						plane_obj.height = plane_desc.height;
						plane_obj.offset = plane_desc.offset;
						if (typeof plane_desc.z_offset !== "undefined") { plane_obj.z_offset = plane_desc.z_offset; }

						// Create elements within plane
						for (var el_name in plane_desc.elements) {
							var el = plane_desc.elements[el_name];
							el_settings = el;
							el_settings.base_url = base_url;
							el_settings.rect = [el.x, el.y, el.width, el.height];
							var el = plane_obj.load_element(el_settings, vp.img_preload_list);
						}

						// Show after preload
						plane_obj.element.hide();

						// Store our plane
						// TO DO: Determine if saving as array is a better choice
						result.planes.push(plane_obj);
					}

					aperture.event_resize();


					// Preload images before running
					viewport.suspend();
					aperture.preload(vp.img_preload_list, function(pl_obj) {
						if (pl_obj.complete) {
							viewport.resume();

							// Show after preload
							for (var i=0;i<result.planes.length;i++) {
								result.planes[i].element.show();
							}

							viewport.event_resize();

							// Run one more time after 250ms to make sure everything is loaded
							window.setTimeout(function() {
								viewport.event_resize();
							}, 250);
						}
					});

					return result;
				},

				create_plane: function(name, options) {
					// Only create plane if it doesn't exist
					var plane = {
						element_indexes: {},
						width: 0,
						height: 0,
						depth: 0,
						offset: 0,
						z_offset: 0,
						translate: {x:0, y:0, z:0, rot: 0},
						element: {},
						elements: [],
						placeholders: [], // Everything that was inside the object before running
						load_element: function(user_options) {
							var def_options = {
								'type': '',
								'opacity': 1
							};
							var options = $.extend(def_options, user_options);
							var el = {};
							el.type = options.type;
							el.rect = {x:0,y:0,w:0,h:0};
							el.translate = {x:0, y:0, z:0, rot: 0, scale: 1};
							el.last_translate = {x:-9999.1234, y:-99999.1234, rot: -999990};
							el.origin = {x:0, y:0};
							el.last_origin = {x:-9999.1234, y:-99999.1234};
							el.hidden = options.hidden;
							el.last_opacity = -999;
							el.el_opacity = options.el_opacity;

							// Create the element via our plugins
							aperture.element_plugins[options.type](vp, plane, options, el);

							// Create initial transformations
							el.rescale();
							el.trans3d();


							return el;
						},
						rescale: function(ignore_children) {
							plane.element.css("left", vp.x_offset * vp.auto_scale);
							plane.element.css("top", vp.y_offset * vp.auto_scale);
							plane.scale_offset_x = vp.auto_scale * plane.offset * vp.x_effect;
							plane.scale_offset_y = vp.auto_scale * plane.offset * vp.y_effect;
							plane.scale_offset_z = vp.auto_scale * plane.offset * vp.z_effect;

							// Rescale children?
							if (typeof ignore_children === "undefined" || ignore_children == false) {
								for (var e=0; e<plane.elements.length; e++) {
									plane.elements[e].rescale();
								}
							}
						},
						get_element_by_name: function(name) {
							if (typeof plane.element_indexes[name] === "undefined") {return;}
							return plane.element_indexes[name];
						}
					};

					// Merge our settings
					$.extend(plane, options);

					plane.element = $('<div class="plane"></div>');
					plane.element.attr('data-name', name);
					vp.element.append(plane.element);

					vp.planes.push(plane);
					vp.plane_indexes[name] = plane;
					return plane;
				},
				get_plane_by_name: function(name) {
					if (typeof vp.plane_indexes[name] === "undefined") {return false;}
					return vp.plane_indexes[name];
				},
				/*
				get_element: function(name) {
					if (typeof vp.indexes[name] === "undefined") {return;}
					return vp.indexes[name].element;
				},
				*/
				stop: function() {
					vp.suspend();
					vp.planes = [];
					vp.element.empty();
				},

				/* ==============================================
				   Events
				============================================== */
				event_scroll: function(e) {
					var scroll_middle = $(window).scrollTop() + (window.viewportSize.getHeight() * 0.5);
					var shift = (scroll_middle - vp.element.offset().top - (vp.scaleheight * 0.5)) / window.viewportSize.getHeight();
					switch (vp.perspective_scroll_axis) {
						case "x":
							vp.shift.pos_x = shift;
						break;
						case "y":
							vp.shift.pos_y = shift;
						break;
						case "z":
							vp.shift.pos_z = shift;
						break;
					}
					
				},
				event_mousemove: function(e) {
					// Cancel if animations are suspended
					if (vp.suspended==true) { return; }

					vp.shift.mouse_on = true;


					if (vp.scalewidth > 0 && vp.scaleheight > 0) {
						// New method is relative to browser size
						// 1. Get decimal position relative to page center
						// Minus 0.5 centers the input
						// * 2 makes this range from 1 to -1 instead of 0.5 to -0.5
						vp.shift.mouse_x = ((e.clientX/window.innerWidth) - 0.5) * 2;
						vp.shift.mouse_y = ((e.clientY/window.innerHeight) - 0.5) * 2;

						// Move relative to center
						vp.shift.mouse_y = vp.shift.mouse_y * vp.y_mul;

						// Low pass filter mouse movement by 10%
						var alpha = 0.1;
						vp.shift.pos_x = vp.shift.mouse_x * alpha + (vp.shift.pos_x * (1.0 - alpha));
						vp.shift.pos_y = vp.shift.mouse_y * alpha + (vp.shift.pos_y * (1.0 - alpha));
					}
				},
				// Use rotation
				event_devicemotion: function(event) {
					
					// Cancel if animations are suspended
					if (vp.suspended==true) { return; }
					if (typeof event.accelerationIncludingGravity.x === "object") {return;}
					if (typeof event.accelerationIncludingGravity.y === "object") {return;}
					if (typeof event.accelerationIncludingGravity.z === "object") {return;}

					// Turns on accelerometer
					vp.shift.accel_on = true;
					vp.shift.devicemotion_on = true;
					vp.shift.o_alpha = event.rotationRate.alpha;
					vp.shift.o_beta = event.rotationRate.beta;
					vp.shift.o_gamma = event.rotationRate.gamma;

					// Limits for rotation are different between browsers
					if (vp.shift.o_alpha > vp.shift.o_max) {
						vp.shift.o_max = vp.shift.o_alpha;
					}
					if (vp.shift.o_beta > vp.shift.o_max) {
						vp.shift.o_max = vp.shift.o_beta;
					}
					if (vp.shift.o_gamma > vp.shift.o_max) {
						vp.shift.o_max = vp.shift.o_gamma;
					}

					// Compatible values with mouse_x and mouse_y.
					// Data is usually value between 0 and 10....on Earth. (9.8 m/s). Divide by 5 (or *.2)
					switch (window.orientation) {
						case -90:
							vp.shift.accel_tilt_x = -vp.shift.o_alpha / vp.shift.o_max * 10;
							vp.shift.accel_tilt_y = vp.shift.o_beta / vp.shift.o_max * 10;
							break;
						case 0:
							vp.shift.accel_tilt_x = vp.shift.o_beta / vp.shift.o_max * 10;
							vp.shift.accel_tilt_y = vp.shift.o_alpha / vp.shift.o_max * 10;
							break;
						case 90:
							vp.shift.accel_tilt_x = vp.shift.o_alpha / vp.shift.o_max * 10;
							vp.shift.accel_tilt_y = -vp.shift.o_beta / vp.shift.o_max * 10;
							break;
						case 180:
							vp.shift.accel_tilt_x = -vp.shift.o_beta / vp.shift.o_max * 10;
							vp.shift.accel_tilt_y = -vp.shift.o_alpha / vp.shift.o_max * 10;
							break;
						default:
							//Invalid
							break;
					}

					if (vp.shift.accel_tilt_x > 1) {
						vp.shift.accel_tilt_x = 1;
					}
					if (vp.shift.accel_tilt_x < -1) {
						vp.shift.accel_tilt_x = -1;
					}
					if (vp.shift.accel_tilt_y > 1) {
						vp.shift.accel_tilt_y = 1;
					}
					if (vp.shift.accel_tilt_y < -1) {
						vp.shift.accel_tilt_y = -1;
					}

					// Low pass filter accelerometer data
					var alpha = 0.03;
					vp.shift.pos_x = vp.shift.accel_tilt_x * alpha + (vp.shift.pos_x * (1.0 - alpha));
					vp.shift.pos_y = vp.shift.accel_tilt_y * alpha + (vp.shift.pos_y * (1.0 - alpha));


					var o_alpha = 0.0001;
					vp.shift.o_max = (vp.shift.o_max * (1.0 - o_alpha));

					return;
				},


				// Accelerometer
				// Depreciated 5/9/2017
				event_gravity: function(event) {  
					
					// Cancel if animations are suspended
					if (vp.suspended==true) { return; }
					if (vp.shift.devicemotion_on==true) { return; } // Devicemotion is way better
					if (typeof event.accelerationIncludingGravity.x === "object") {return;}
					if (typeof event.accelerationIncludingGravity.y === "object") {return;}
					if (typeof event.accelerationIncludingGravity.z === "object") {return;}

					// Turns on accelerometer
					vp.shift.accel_on = true;
					vp.shift.gravity_on = true;

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
					vp.shift.accel_tilt_x += 0.5;
					vp.shift.accel_tilt_y += 0.5;

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
					vp.auto_scale = vp.element.width() / vp.width;
					vp.auto_scale = vp.auto_scale * vp.scale_offset;
					vp.scalewidth = vp.auto_scale * vp.width;
					vp.scaleheight = vp.auto_scale * vp.height;


					// Rescale the whole scene
					for (var p=0; p<vp.planes.length; p++) {
						vp.planes[p].rescale();
					}

					// Trigger scroll
					obj.event_scroll();
				},



				// Function is called once every frame by HTML5
				event_animate: function(timestamp) {
					// Cancel if animations are suspended
					if (vp.suspended==true) { return; }

					for (var p=0; p<vp.planes.length; p++) {
						var plane = vp.planes[p];

						// Move the plane differently for mouse vs tilt
						var pos_x = vp.shift.pos_x * plane.scale_offset_x;
						var pos_y = vp.shift.pos_y * plane.scale_offset_y;
						var pos_z = plane.z_offset + (vp.shift.pos_z * plane.scale_offset_z);

						aperture.transform(plane.element[0], "translate3d(" + pos_x + "px, " + pos_y + "px, " + pos_z + "px)");

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
					vp.placeholders.detach();
				},

				init: function() {
					// Clear the viewport and setup the class
					//vp.element.empty();
					vp.placeholders = vp.element.find("*");
					vp.element.addClass("aperture-viewport");

					// New behavior: Leave placeholders in place until we resume
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
		transform: function(el, val) {
			// This uses what was detected in enumerate_css_shortcuts()
			el.style[aperture.css_shortcuts.transform] = val;
		},

		// NOTE: We aren't using this. Since the whole canvas is scaled we're calculating this when transforming the <el>
		transform_origin: function(el, val) {
			// This uses what was detected in enumerate_css_shortcuts()
			el.style[aperture.css_shortcuts.transform_origin] = val;
		},

		// Enumerates the CSS attribute we're supposed to use + finds out if this browser supports 3D
		enumerate_css_shortcuts:function() {
			var has3d;

			// Left side is direct : Right side is CSS
			var	transforms = {
				'webkitTransform':'-webkit-transform',
				'OTransform':'-o-transform',
				'msTransform':'-ms-transform',
				'MozTransform':'-moz-transform',
				'transform':'transform'
			};

			// Add temporary element to get the computed style.
			var el = document.createElement('p');
			document.body.insertBefore(el, null);

			// Loop through each transform. 
			// Start with the beta methods and attempt standardized method after
			for (var t in transforms) {

				// This style exists in our element...
				if (el.style[t] !== undefined) {

					// Attempt to translate our element
					el.style[t] = "translate3d(1px,2px,3px)";
					has3d = window.getComputedStyle(el).getPropertyValue(transforms[t]);
					if (has3d) {
						aperture.css_shortcuts.transform = t;
						aperture.css_shortcuts.transform_origin = t + "Origin";
					}

				}
			}

			// Remove our temporary element
			document.body.removeChild(el);
		},
		init: function() {
			// Check if we support 3D
			obj.enumerate_css_shortcuts();

			// Hook all the standard events so we can route them to our viewports
			$("body").mousemove(obj.event_mousemove);
			window.ondevicemotion = obj.event_devicemotion;

			$(window).resize(obj.event_resize);

			$(window).scroll(obj.event_scroll);

			// Begin.
			obj.start_animation_loop();

			// Check if our viewports are still active
			if (typeof mint !== "undefined") {
				mint.always.on("ready", function() {
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
		event_scroll: function(ev) {
			for (var i=0; i<obj.viewports.length; i++) {
				if (obj.viewports[i].perspective_type == "scroll") {
					obj.viewports[i].event_scroll(ev);
				}
			}
		},
		event_mousemove: function(ev) {
			for (var i=0; i<obj.viewports.length; i++) {
				if (obj.viewports[i].perspective_type == "default") {
					obj.viewports[i].event_mousemove(ev);
				}
			}
		},
		event_devicemotion: function(ev) {
			for (var i=0; i<obj.viewports.length; i++) {
				if (obj.viewports[i].perspective_type == "default") {
					obj.viewports[i].event_devicemotion(ev);
					//obj.viewports[i].event_gravity(ev);
				}
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

	if (typeof mint !== "undefined") {
		mint.page.on("ready", function() {
			obj.init();
		});

		// This is called after a "load" instead of ready because most page loads will hide content via "display:none". 
		// We need to resize objects once they are visible and "load" comes after the page has loaded
		mint.always.on("load", function() {
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



/* =======================================================
	Aperture Element Plugins

	Sometimes an <img> just isn't enough
 ======================================================= */

(function($) {

	// Call by most plugins
	aperture.element_plugins._default = function(vp, plane, options, el) {

		// Add name to index of names
		if (typeof options.name === "string") {
			plane.element_indexes[options.name] = el;
		}


		// We can use a rect[x,y,w,h] to define sizes and positions
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

		if (typeof options.origin !== "undefined") {
			el.origin.x = options.origin.x;
			el.origin.y = options.origin.y;
		}

		// TO DO: Add rot, z, scale, etc...
		if (typeof options.translate !== "undefined") {
			if (typeof options.translate.x !== "undefined") { el.translate.x = options.translate.x; }
			if (typeof options.translate.y !== "undefined") { el.translate.y = options.translate.y; }
			if (typeof options.translate.z !== "undefined") { el.translate.z = options.translate.z; }
			if (typeof options.translate.rot !== "undefined") { el.translate.rot = options.translate.rot; }
			if (typeof options.translate.scale !== "undefined") { el.translate.scale = options.translate.scale; }
		}


		// This func is called to reposition the element without resizing
		el.repos = function() {
			el.element.css("left", (vp.auto_scale * el.rect.x) + "px");
			el.element.css("top", (vp.auto_scale * el.rect.y) + "px");
		};
		el.trans3d = function() {

			if (!isFinite(vp.auto_scale)) { // Check for NaN or inf
				return;
			}

			// Translate: Don't change opacity if unchanged
			if (el.last_opacity != el.el_opacity) {
				el.element[0].style.opacity = el.el_opacity;
				el.last_opacity = el.el_opacity;
			}

			// Translate: Don't set if unchanged
			if (el.last_translate.x != el.translate.x ||
				el.last_translate.y != el.translate.y ||
				el.last_translate.z != el.translate.z ||
				el.last_translate.rot != el.translate.rot || 
				el.last_translate.scale != el.translate.scale || 
				el.last_origin.x != el.origin.x ||
				el.last_origin.y != el.origin.y) {

				var real_x = el.translate.x - el.origin.x;
				var real_y = el.translate.y - el.origin.y;

				// Pos is different. Set.
				aperture.transform(el.element[0],"translate3d(" + (real_x*vp.auto_scale) + "px, " + (real_y*vp.auto_scale) + "px, " + (el.translate.z*vp.auto_scale) + "px)  rotateZ(" + el.translate.rot + "deg) scale(" + (el.translate.scale) + ") ");

				// NOTE on el.translate.scale
				// Don't multiply by vp.auto_scale because we're already scaling the whole thing in JS

				// Store position for next trans3d call
				el.last_translate.x = el.translate.x;
				el.last_translate.y = el.translate.y;
				el.last_translate.z = el.translate.z;
				el.last_translate.rot = el.translate.rot;
				el.last_translate.scale = el.translate.scale;
			}
		};
		// This func is called whenever the window resizes
		el.rescale = function() {
			var el = this;

			// Force everything to rescale
			el.last_translate.x = -154321.32313;
			el.last_translate.y = -154321.32313;
			el.last_translate.z = -154321.32313;
			el.last_translate.rot = -154321.32313;
			el.last_translate.scale = -154321.32313;
			el.last_origin.x = -154321.32313;
			el.last_origin.y = -154321.32313;

			// Reposition
			el.repos();

			// Resize object
			el.element.width(vp.auto_scale * el.rect.w);
			el.element.height(vp.auto_scale * el.rect.h);
		};
	};

	aperture.element_plugins.img = function(vp, plane, options, el) {
		el.element = $("<img>");
		el.element.attr("data-pin-no-hover", "data-pin-no-hover"); // gets rid of share buttons
		el.element.attr("data-el-name", options.name);
		//el.element.data("obj", el);

		if (typeof options.src !== "undefined" && options.src != "#") {
			vp.img_preload_list.push(options.base_url + options.src);
			el.element.attr("src", options.base_url + options.src);
		}


		// Add DOM element
		plane.element.append(el.element);

		// Add to list of elements
		plane.elements.push(el);

		// Attach our standard events to this element
		aperture.element_plugins._default(vp, plane, options, el);
	};
	aperture.element_plugins.split_png = function(vp, plane, options, el) {
		var context;
		var canvas = document.createElement('canvas');
		var rgb_loaded = false;
		var alpha_loaded = false;

		var img_rgb = new Image();
		var img_alpha = new Image();

		el.element = $('<img />', {src:"#", alt: ''});
		el.element.attr("data-pin-no-hover", "data-pin-no-hover"); // gets rid of share buttons
		el.element.attr("data-el-name", options.name);

		// Add DOM element
		plane.element.append(el.element);

		// Create placeholder functions now so it doesn't throw errors during load
		el.repos = function() { };
		el.trans3d = function() { };
		el.rescale = function() { };

		// Checks both the alpha and rgb have been loaded before running
		var check_loaded = function() {
			if (!rgb_loaded) {
				return;
			}
			if (!alpha_loaded) {
				return;
			}
			canvas.style.display = 'none';

			context = canvas.getContext('2d');
			context.clearRect(0, 0, canvas.width, canvas.height);
			context.drawImage(img_rgb, 0, 0, canvas.width, canvas.height);

			context.globalCompositeOperation = 'xor';
			context.drawImage(img_alpha, 0, 0, canvas.width, canvas.height);


			var dataURL = canvas.toDataURL('image/png');

			el.element[0].src = dataURL;


			// Add to list of elements
			plane.elements.push(el);

			// TO DO: Add to vp.indexes
			if (typeof options.name === "string") {
				vp.indexes[options.name] = el;
			}

			// Attach our standard events to this element
			aperture.element_plugins._default(vp, plane, options, el);

			el.rescale();
		};

		vp.img_preload_list.push(options.base_url + options.src + "-rgb.jpg");
		vp.img_preload_list.push(options.base_url + options.src + "-alpha.png");

		img_rgb.src = options.base_url + options.src + "-rgb.jpg";
		img_rgb.onload = function(){
			canvas.width = this.width;
			canvas.height = this.height;
			rgb_loaded = true;
			check_loaded();
		};
		img_alpha.src = options.base_url + options.src + "-alpha.png";
		img_alpha.onload = function(){
			alpha_loaded = true;
			check_loaded();
		};
	};




	aperture.element_plugins.canvas = function(vp, plane, options, el) {
		el.element = $("<canvas></canvas>");
		el.element.attr("data-pin-no-hover", "data-pin-no-hover"); // gets rid of share buttons
		el.element.attr("data-el-name", options.name);

		// Add DOM element
		plane.element.append(el.element);

		// Add to list of elements
		plane.elements.push(el);

		// Attach our standard events to this element
		aperture.element_plugins._default(vp, plane, options, el);
	};

	aperture.element_plugins.vid = function(vp, plane, options, el) {
		// See iOS notes for autoplay - https://webkit.org/blog/6784/new-video-policies-for-ios/
		el.element = $("<video autoplay loop muted playsinline></video>");
		el.element.attr("data-pin-no-hover", "data-pin-no-hover"); // gets rid of share buttons
		el.element.attr("data-el-name", options.name);

		if (typeof options.mp4 !== "undefined") {
			el.element.append($("<source>").attr("type", "video/mp4").attr("src", options.base_url + options.mp4));
		}
		if (typeof options.webm !== "undefined") {
			el.element.append($("<source>").attr("type", "video/webm").attr("src", options.base_url + options.webm));
		}

		// Add DOM element
		plane.element.append(el.element);

		// Add to list of elements
		plane.elements.push(el);

		// Attach our standard events to this element
		aperture.element_plugins._default(vp, plane, options, el);
	};

})(jQuery);






// TO DO: Lots going on here that might not be needed for this library. Clean this up.
(function (window) {
	window.viewportSize = {
		getHeight: function () {
			return getSize("Height");
		},
		getWidth: function () {
			return getSize("Width");
		},
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
		else {
			// Default to use window["inner" + Name]
			size = window["inner" + Name];
		}
		return size;
	};

})(this);