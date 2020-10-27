## Hashbang Object Overview

**Hashbang Object javascript library allows you to work intuitively with "`#!`" hashbang (shebang) URLs.**

Hashbang Object javascript enables easy implementation of
stateful AJAX pages. Stateful AJAX pages display the same content
whenever accessed directly.

Hashbang Object provides you with plain javascript object
`window.hashbang` where you can store your stateful
information. Anything you store into this object will cause URL
hash to be automatically updated with serialized
`window.hashbang` object..

And vice versa any change to URL hash will be reflected in
`window.hashbang` object.

## Example How It Works

Just include `hashbang.js` javascript file on your page.

`<script src="my-directory-somewhere/hashbang.js"></script>`

```
  window.hashbang.gallery=[11, 12];
  window.hashbang.zoom=2;
```

This javascript code will cause URL hash part to change to
`#!gallery[]=11&gallery[]=12&zoom=2`

When user revisits the page with the same URL hash the `window.hashbang` object will restore the previously stored values.

It is really that simple!

## Advantages

**multi-application support**
If you have multiple javascript applications that need to
capture their state they will not interfere one with
another. For example Video Gallery of yours can capture the
information about selected video into URL hash without
destroying information stored in URL by your Image Gallery.

**native javascript object representation**
You don't need to worry about URL hash serialization and parsing.
You just use simple javascript object to store your
values and read previously stored values from. The rest is
handled automatically.

## Use Case Example

John has a website with javascript-driven gallery where user can
choose multiple images.  John would like to allow visitors to
select images and then share the URL of the page with friends
while somehow magically having the URL capture what images were
selected for others to see.

That is where Hashbang Object javascript comes in.

John programs his gallery so whenever an image is selected he
stores image id into Hashbang Object.

```
window.hashbang.gallery=[];

function onSelect(imageId) {
  window.hashbang.gallery.push(imageId);
}
```

That is all! Everything you store in
`window.hashbang` object will get serialized into URL
so when the URL is shared with friends it carries everything
you have previously stored in `window.hashbang` object.

In this case after the user selects multiple images the URL will look for example like this:
`http://example.com/#gallery[]=9&gallery[]=1&gallery[]=4` .

When this URL is shared and friend visits the page the `window.hashbang.gallery` array
will contain the previously stored values so you can pre-select the same images upon page load.

## Events

You can listen to following events on `window` object:

*   **hashbang-init** - after initialization of Hashbang Object and creation of `window.hashbang` object.
*   **hashbang-parse** - upon load and URL hash change and `window.hashbang` object update.
*   **hashbang-serialize** - upon `window.hashbang` object change and URL hash update.

## Observers

There are two methods that provide callback functionality when `window.hashbang`
or URL hash or any of those changes.

```
window.hashbangObserve(prop, callback [, filter, [event] ]);
window.hashbangUnobserve(prop, callback);
```

Params:
* `prop` mixed
  * **string**: name of the property on `window.hashbang` object.
  * **array**: of nested `window.hashbang` property names. E.g. to watch `window.module.id` use `["module", "id"]`
  * **undefined** or `false`: watch whole object
* `callback(newVal, oldVal)` your callback function
* `filter` is used to call object only if the new value matches
  * `function(newVal, oldVal)`: if the filter is a function it must return `true` or `false`
  * `RegExp`: you can pass regexp object to match value against. All values (even undefined) are converted to string before matching.
  * **string**: any fixed string that the property value must match in. All property values are converted to string first.
* `event` can by any of this values
  * `hashbang-init` - to run the callback immediatelly after calling `window.hashbangObserve()` if `filter` matches
  * `hashbang-parse` - to run the callback when URL is directly modified
  * `hashbang-serialize` - to run the callback when `window.hashbang` object is modified directly
  * **array**: or an array of any combination of values above

Examples:
```
window.hashbangObserve('open', myCallback);
window.hashbang.open=123; // will trigger
location.hash="#!open=345"; // will trigger

window.hashbangObserve(["module", "id"], myCallback, /\d/, 'hashbang-serialize');
window.hashbang.module.id=123; // will trigger myCallback
location.hash="#!module[id]=345"; // will NOT trigger (hashbang-parse event not specified)

// Call only when window.hashbang == "open"
window.hashbangObserve("contact", myCallback, "open", 'hashbang-serialize');

// Run immediatelly (hashbang-init) and everytime URL changes (hashbang-parse)
window.hashbangObserve("open", myCallback, false, ['hashbang-parse', 'hashbang-init']);
```

## Advanced Configuration

If you want to use '#' instead of '#!' then run the code
`window.hashbangSeparator="#";` before you include
hashbang script.

## Tools

Two useful functions are provided for creation and parsing of hashbang hashes:

*   `window.hashbangParse(hash):object`
*   `window.hashbangSerialize(object):hash`

Example:
```
$(link).attr('href', window.hashbangSerialize({"a": 1, "b": 2}));
var info=window.hashbangParse("#!gallery[]=11&amp;gallery[]=12&amp;zoom=2");
```
