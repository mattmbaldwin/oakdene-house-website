// Staff editor: hide the controls that change the live site, so staff
// changes stay as drafts until a full editor publishes them at /admin/.
// Decap's class names change between versions, so this matches the button
// text instead. It is a convenience for staff, not a security control:
// anyone who can sign in could still publish from /admin/.
(function () {
  var HIDE = /^(publish|unpublish|delete published entry)/i;

  function hide(root) {
    var items = root.querySelectorAll('button, [role="button"], [role="menuitem"]');
    for (var i = 0; i < items.length; i++) {
      var label = (items[i].textContent || '').trim();
      if (HIDE.test(label)) items[i].style.display = 'none';
    }
  }

  new MutationObserver(function () { hide(document.body); })
    .observe(document.documentElement, { childList: true, subtree: true });
})();
