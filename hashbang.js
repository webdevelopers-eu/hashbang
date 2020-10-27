/**
 * MIT LICENSE
 *
 * Compatibility: ie8+, other modern browsers
 * Note: Include jQuery on the page for ie8 to be able to fire hashbang-parse and hashbang-serialize events.
 *
 * Read:
 * http://googlewebmastercentral.blogspot.cz/2009/10/proposal-for-making-ajax-crawlable.html
 * https://developers.google.com/webmasters/ajax-crawling/docs/specification
 *
 * Supports:
 * - Hash syntax: #!/PATH/PART?VARIABLES
 * - Hash syntax: #!VARIABLES
 * - Arrays: var[]=val&var[]=val or var[0]=val&var[1]=val
 * - Objects: var[prop]=val&var[prop2]=val
 *
 * Use following events to hook on hashbang:
 *
 * $(window).on('hashbang-init',  function()); // upon window.hashbang object initialization
 * $(window).on('hashbang-parse',  function()); // upon load and URL hash change and window.hashbang object update
 * $(window).on('hashbang-serialize',  function()); // upon window.hashbang object change and URL hash update
 *
 * The object window.hashbang is readable/writable and keeps parsed
 * representation of URL hashbang hash.
 *
 * window.hashbang.something={"any": 1, "else": [{"a":1}, {"b":2}]};
 *
 * If the URL hash conains unescaped question mark then the path component (starting with '/') before
 * question mark is stored in window.hashbang["#path"] special read/write property.
 *
 * Path component must start with '/'.
 *
 * #!/my/path?var1=1
 * #!/my/path
 *
 *
 * If you want to use '#' insead of '#!' then run this code before you include hashbang script:
 *   window.hashbangSeparator="#";
 *
 * Two usefull functions are provided for creation and parsing of hashbang hashes:
 *   window.hashbangParse(hash):object
 *   window.hashbangSerialize(object):hash
 *
 * Example:
 *   $(link).attr('href', window.hashbangSerialize({"a": 1, "b": 2}));
 *
 * @package    Hashbang Object
 * @author     Daniel Sevcik <sevcik@webdevelopers.cz>
 * @version    2.0
 * @copyright  2014 Daniel Sevcik
 * @since      2014-07-16 22:22:34 UTC
 */
(function() {
    'use strict';

    var log=function() {
	arguments[0]='Hashbang Object: ' + arguments[0];
	if (console && console.log) {
	    if (console.log.apply) {
		console.log.apply(console, arguments);
	    } else { // IE8
		console.log(arguments[0]);
	    }
	}
    };
    log("Loading... " + (typeof Object.observe == 'function' ? 'Object.observe available' : ''));

    if ('hashbang' in window) {
	log("ERROR: window.hashbang already exists! The Hashbang script was included twice or there is other conflicting app.");
	return;
    }

    window.hashbangSeparator=window.hashbangSeparator || '#!';

    var ourHashUpdate;
    var hasHashbangFormat=false;
    var updateTimeout;
    var hashbangInterval;

    function setHash(hash) {
	ourHashUpdate=hash;
	// window.location.hash=ourHashUpdate; - FF unescapes the values
	var url = (window.location.href + '#').replace(/#.*$/, hash.replace(/#+$/, ''));

	//window.location.href=url; // Setting '#' or '' scrolls the page up in Ch73

	history.replaceState({"hashbang": true}, "", url);

	log("Set new hash: " + hash + " | current url: " + url);
    }

    function getHash() {
	// window.location.hash - FF unescapes it!
	// window.location.href.replace(/^[^#]+/, ''); - FF35 does escape it extra
	return window.location.hash;
    }

    function trigger(name) {
	const el=document;
	const e=document.createEvent('HTMLEvents');
	e.initEvent(name, true, true);

	log("Triggering event " + name + " on document object");
	el.dispatchEvent(e);
    }

    function listen(obj, name, callback) {
	if(obj.addEventListener) {
	    // log("Using addEventListener for " + name);
	    obj.addEventListener(name, callback, false);
	} else if (obj.attachEvent) {
	    // log("Using attachEvent for " + name);
	    obj.attachEvent(name, callback, false);
	}
    }

    function createProxy(obj) {
	if (typeof obj != 'object' || obj === null) {
	    log("Warning: Hashbang data must be of type object, array, string, number! Received `" + (typeof obj) + "`", obj);
	    obj = {};
	}

	return new Proxy(obj,{
	    set: function(target, key, value) {
		const changed = target[key] !== value;

		log(`${key} = ${value}`);
		if (value === null) {
		    if (typeof target[key] != 'undefined') { // for error: 'deleteProperty' on proxy: trap returned falsish for property XY
			delete target[key];
		    }
		} else if (typeof value === 'object') {
		    target[key] = createProxy(value);
		    Object.keys(value).forEach((k) => target[key][k] = value[k]);
		} else {
		    target[key] = value;
		}


		if (changed) {
		    updateHash();
		}

		return true;
	    },

	    deleteProperty: function(target, prop) {
		if (prop in target) {
		    delete target[prop];
		    log(`delete ${prop}`);
		    updateHash();
		}
		return true; // always true
	    }
	});
    }

    function updateHash() { // Delay because when extensive window.hashbang modification the handler is called too often
	var hash=window.hashbangSerialize(window.hashbang);
	setHash(hash);

	if (!updateTimeout) {
	    updateTimeout=setTimeout(function() {
		updateTimeout = null;
		trigger('hashbang-serialize');
	    }, 50);
	}
    }

    window.hashbangSerialize=function(what) {
	function serialize(keys, val) {
	    // log('Serializing', keys, val);
	    var ret=[], i;

	    if (val === null) { // null is object
		val='';
	    }
	    var valType=val instanceof Array ? 'array' : typeof val;

	    switch (val instanceof Array ? 'array' : typeof val) {
	    case 'boolean':
		val=(val ? 1 : '');
	    case 'number':
	    case 'string':
		var key=(keys.shift() || 'nokey') + (keys.length && '[' + keys.join('][') + ']' || '');
		ret.push(key + (('' + val).length ? '=' + encodeURIComponent(val) : ''));
		break;
	    case 'array':
		for (i=0; i < val.length; i++) {
		    keys.push(typeof val[i] == 'object' ? i : '');
		    ret=ret.concat(serialize(keys.concat([]), val[i]));
		    keys.pop();
		}
		break;
	    case 'object':
		for (i in val) {
		    if (i == '#path') continue;
		    keys.push(encodeURIComponent(i));
		    ret=ret.concat(serialize(keys.concat([]), val[i]));
		    keys.pop();
		}
		break;
	    default:
		log("The value type '" + (typeof val) +"' is not supported.");
	    }
	    return ret;
	}

	var path=(what['#path'] || '');
	var hash=serialize([], what).join('&');
	return hash || path ? window.hashbangSeparator + path + (path && hash ? '?' : '') + hash : '#';
    };

    function toArray(obj) {
	var i;
	if (typeof obj == 'object') {
	    var hb=obj.__isArray__ || 0;
	    delete obj.__isArray__;
	    var arr=[];
	    for (i in obj) {
		obj[i]=toArray(obj[i]);
		arr.push(obj[i]);
	    }
	    if (arr.length == hb) { // convert to plain array
		var seq=true;
		for (i=0; i < hb; i++) { // make sure the numbers are sequential
		    if (typeof obj[i] == 'undefined') return obj; // not an array
		}
		obj=arr;
	    }
	}
	return obj;
    }

    function updateObject() {
	if (getHash() == ourHashUpdate) {
	    return; // triggered by our updateHash()
	}
	var fireEvent='hashbang' in window ? 'hashbang-parse' : 'hashbang-init';
	var hash=getHash();
	ourHashUpdate=hash;
	hasHashbangFormat=isHashbang(hash);
	if (!hasHashbangFormat) fireEvent='hashbang-unparsable';
	var obj=window.hashbangParse(hash);

	window.hashbang=createProxy(obj);

	// createProxy(window.hashbang);
	log("Object updated (" + fireEvent + "): " + JSON.stringify(obj));
	trigger(fireEvent);
    }

    function isHashbang(hash) {
	return (hash.substr(0, window.hashbangSeparator.length) == window.hashbangSeparator && hash.substr(2));
    }

    window.hashbangParse=function (hash) {
	var obj={};

	if (isHashbang(hash)) {
	    var pointer;
	    var pathRE=/^(\/[\/a-z0-9. %_~!$'()*+,;:@-]*)(\?|$)/i; // no '&=' even though path part allows it
	    hash=hash.substr(window.hashbangSeparator.length); // remove '#!'
	    if (hash.match(pathRE)) {
		obj["#path"]=hash.match(pathRE)[1];
		hash=hash.replace(pathRE, '');
	    }
	    var params=hash ? hash.split('&') : [];
	    for (var i=0; i < params.length; i++) {
		var param=params[i].split('=');
		var key=param.shift().replace(/]$/, '');
		var val=decodeURIComponent(param.join('='));

		var keys=key.replace(/\]\[/g, '[').split('[');
		pointer=obj;
		while (keys.length) {
		    var prop=decodeURIComponent(keys.shift()) || pointer.__isArray__;
		    if ((prop + '').match(/^[0-9]+$/) && typeof pointer[prop] == 'undefined') {
			pointer.__isArray__++; // hint possible array
		    }
		    if (keys.length) {
			if (typeof pointer[prop] != 'object') {
			    pointer[prop]={"__isArray__": 0};
			}
			pointer=pointer[prop];
		    } else {
			pointer[prop]=val;
		    }
		}
	    }
	    obj=toArray(obj);
	}

	return obj;
    };

    /**
     * List of observers installed by window.hashbangObserve()
     * @access private
     * @var Array
     */
    var observers = [];
    listen(window, 'hashbang-parse', observe);
    listen(window, 'hashbang-serialize', observe);

    function observe(ev) {
	observers.forEach(function(observer) {
	    const val = getProp(observer.prop);
	    const valJSON = JSON.stringify(val);

	    if (observer.event.indexOf(ev.type) == -1) {
		return;
	    }
	    if (valJSON == observer.last) {
		return;
	    }

	    if (observer.filter(val)) {
		observer.callback(val, observer.last && JSON.parse(observer.last));
	    }

	    observer.last = valJSON;
	});
    }

    /**
     * Observe hashbang property change.
     *
     * Examples:
     *
     * window.hashbangObserve('open', myCallback);
     * window.hashbang.open=123; // will trigger
     * location.hash="#!open=345"; // will trigger
     *
     * window.hashbangObserve(["module", "id"], myCallback, /\d/, 'hashbang-serialize');
     * window.hashbang.module.id=123; // will trigger myCallback
     * location.hash="#!module[id]=345"; // will NOT trigger (hashbang-parse event not specified)
     *
     * @access private
     * @param mixed string or array of window.hashbang object nested keys or false to don't match property name
     * @param function callback(newValue, oldValue)
     * @param mixed filter callback, or RegExp object or string or number to match new value to
     * @param mixed event string 'hashbang-parse': to listen only when URL hashbang changes, 'hashbang-serialize': listen when window.hashbang is changed, undefined: listen to both
     * @return Window object
     */
    window.hashbangObserve = function(prop, callback, filter, event) {
	if (!event) {
	    event = ['hashbang-serialize', 'hashbang-parse'];
	} else if (typeof event == 'string') {
	    event = event.split(/\s+/);
	}

	prop = typeof prop == 'string' ? [prop] : prop;

	observers.push({
	    "prop": prop,
	    "event": event,
	    "last": JSON.stringify(getProp(prop)),
	    "callback": callback,
	    "filter": typeof filter == 'function' ? filter : function(v) {return !filter || (v + '').match(filter);}
	});

	return this;
    };

    /**
     * Unobserve hashbang property.
     *
     * Example:
     *
     * window.hashbangObserve(["module", "id"], myCallback, /\d/, 'hashbang-parse');
     *
     * window.hashbangUnobserve(["module", "id"], myCallback);
     * or
     * window.hashbangUnobserve(false, myCallback);
     *
     * @access private
     * @param mixed string or array of window.hashbang object nested keys or false to don't match property name
     * @param function callback to match
     * @return Window object
     */
    window.hashbangUnobserve = function(prop, callback) {
	prop = typeof prop == 'string' ? [prop] : prop;

	observers = observers.filter(function(observer) {
	    if (prop && JSON.stringify(observer.prop) != JSON.stringify(prop)) {
		return true;
	    } else if (callback != observer.callback) {
		return true;
	    }
	    return false;
	});

	return this;
    };

    function getProp(prop) {
	var val = window.hashbang;
	prop.forEach(function(p) {
	    val = typeof val == 'undefined' ? undefined : val[p];
	});
	return val;
    }

    // First run
    updateObject(); // before Object.observe

    window.hashbang = createProxy(window.hashbang);

    // Observe Hash
    if ("onhashchange" in window) {
	listen(window, "hashchange", updateObject);
	listen(window, "onhashchange", updateObject); // ie8
	// window.onhashchange=updateObject; // ie8
    } else {
	throw ("The event hashchange is not supported!");
    }
})();
