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
 * If the URL hash conains unescape question mark then the path component (starting with '/') before
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
 * @version    1.0
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

    var lock=false;
    var ourHash;
    var lastSerialized;
    var hasHashbangFormat=false;
    var updateTimeout;
    var hashbangInterval;

    function setHash(hash) {
	ourHash=hash;
	// window.location.hash=ourHash; - FF unescapes the values
	var url = (window.location.href + '#').replace(/#.*$/, hash.replace(/#+$/, ''));

	//window.location.href=url; // Setting '#' or '' scrolls the page up in Ch73
	history.replaceState({"hashbang": true}, "", url);

	log("Set new hash: " + hash + " | current url: " + url);
    }

    function getHash() {
	// window.location.hash - FF unescapes it!
	return window.location.href.replace(/^[^#]+/, '');
    }

    function trigger(name) {
	log("Triggering event " + name + " on window object...");
	var el=document;
	var e;
	if (typeof jQuery == 'function') {
	    jQuery('body').trigger(name);
	} else if (document.createEventObject) { // IE
	    e=document.createEventObject();
	    try {
		el.fireEvent(name, e);
	    } catch (e) { // IE8 custom events fail!
		log("WARNING: Include jQuery on the page to fire events in archaic browsers.");
	    }
	} else {
	    e=document.createEvent('HTMLEvents');
	    e.initEvent(name, true, true);
	    el.dispatchEvent(e);
	}
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

    function observe(obj) {
	// Observe Object
	if (typeof Object.observe == 'function') {
	    Object.observe(obj, updateHash);
	    for (var i in obj) {
		if (typeof obj[i] == 'object') {
		    observe(obj[i]);
		}
	    }
	} else {
	    clearInterval(hashbangInterval);
	    hashbangInterval=setInterval(function() {
		var serialized=JSON.stringify(window.hashbang);
		if (lastSerialized == serialized) return; // same
		// log("Updating hash... last: " + lastSerialized + ", current: " + serialized);
		lastSerialized=serialized;
		updateHash();
	    }, 500);
	}
	return obj;
    }

    function updateHash() { // Delay because when extensive window.hashbang modification the handler is called too often
	clearTimeout(updateTimeout);
	updateTimeout=setTimeout(function() {
	    var hash=window.hashbangSerialize(window.hashbang);
	    setHash(hash);
	    observe(window.hashbang);
	    trigger('hashbang-serialize');
	}, 50);
    }

    window.hashbangSerialize=function(what) {
	function serialize(keys, val) {
	    // log('Serializing', keys, val);
	    var ret=[], i;

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
	if (getHash() == ourHash) {
	    return; // triggered by our updateHash()
	}
	var fireEvent='hashbang' in window ? 'hashbang-parse' : 'hashbang-init';
	var hash=getHash();
	ourHash=hash;
	hasHashbangFormat=isHashbang(hash);
	if (!hasHashbangFormat) fireEvent='hashbang-unparsable';
	var obj=window.hashbangParse(hash);

	lock=true;
	window.hashbang=obj;
	lastSerialized=JSON.stringify(window.hashbang);
	lock=false;

	observe(window.hashbang);
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


    // First run
    updateObject(); // before Object.observe

    observe(window.hashbang);
    if (typeof Object.observe == 'function' && typeof window.__defineSetter__ == 'function') {
	log("Watching window.hashbang");
	var watchValue=window.hashbang;
	window.__defineGetter__('hashbang', function() {return watchValue;});
	window.__defineSetter__('hashbang', function(val) {watchValue=val; !lock && updateHash(); return watchValue;});
    }

    // Observe Hash
    if ("onhashchange" in window) {
	listen(window, "hashchange", updateObject);
	listen(window, "onhashchange", updateObject); // ie8
	// window.onhashchange=updateObject; // ie8
    } else {
	throw ("Hashbang: The event hashchange is not supported!");
    }
})();
