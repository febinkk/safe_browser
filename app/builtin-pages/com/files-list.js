import * as yo from 'yo-yo'
import prettyBytes from 'pretty-bytes'
import { niceDate } from '../../lib/time'
import { ucfirst } from '../../lib/strings'

export function archives (entries, opts={}) {

  var head = ''
  if (opts.showHead) {
    head = yo`<div class="fl-head">
      <div class="fl-name">Name</div>
      <div class="fl-author">Author</div>
      <div class="fl-updated">Last Updated</div>
      <div class="fl-version">Version</div>
      <div class="fl-size">Size</div>
      <div class="fl-status">Status</div>
    </div>`
  }

  return yo`<div class="files-list">
    ${head}
    <div class="fl-rows">
      ${archives.map((archive, index) => {
        // is the selected archive?
        var isSelected = index === opts.selectedIndex

        // status column
        var status = ''
        if (archive.isDownloading)
          status = 'Downloading'
        else if (archive.isSharing)
          status = 'Sharing'

        // render row
        return yo`<div class=${"fl-row"+(isSelected?' selected':'')} onclick=${onClick(index)}>
          <div class="fl-name">${archive.name||'Untitled'}</div>
          <div class="fl-author">${archive.author ? archive.author.name : ''}</div>
          <div class="fl-updated">${archive.mtime ? ucfirst(niceDate(archive.mtime)) : '--'}</div>
          <div class="fl-version">${archive.version || '--'}</div>
          <div class="fl-size">${archive.size ? prettyBytes(archive.size) : '--'}</div>
          <div class="fl-status">${status}</div>
        </div>`
      })}
    </div>
  </div>`
}

export function entriesListToTree (archiveInfo) {
  var m = archiveInfo.manifest

  // root node is the archive itself
  var rootNode = {
    isOpen: true,
    entry: {
      type: 'directory',
      name: archiveInfo.name || '/',
      path: '/',
      key: archiveInfo.key
    }
  }

  // iterate the list, recurse the path... build the tree!
  archiveInfo.entries.forEach(e => addEntry(rootNode, splitPath(e.name), e))
  function addEntry (parent, path, entry) {
    // take a name off the path
    var name = path.shift()

    // add children if needed
    parent.children = parent.children || {}

    if (path.length === 0) {
      // end of path, add entry
      parent.children[name] = parent.children[name] || {} // only create if DNE yet
      parent.children[name].entry = entry
      parent.children[name].entry.path = entry.name
      parent.children[name].entry.name = name
    } else {
      // an ancestor directory, ensure the dir exists
      parent.children[name] = parent.children[name] || { entry: { type: 'directory', name: name } }
      // descend
      addEntry(parent.children[name], path, entry)
    }
  }

  return rootNode
}

export function archiveEntries (tree, opts={}) {
  // render the header (optional)
  var head = ''
  if (opts.showHead) {
    head = yo`<div class="fl-head">
      <div class="fl-name">Name <span class="icon icon-down-open-mini"></span></div>
      <div class="fl-updated">Last Updated</div>
      <div class="fl-size">Size</div>
    </div>`
  }

  // helper to render the tree recursively
  function renderNode (node, depth) {
    var els = []
    const isOpen = node.isOpen
    const entry = node.entry

    // only render if "above ground." (this is how we optionally skip rendering ancestors)
    if (depth >= 0) {

      // add spacers, for depth
      var spacers = []
      for (var i=0; i <= depth; i++)
        spacers.push(yo`<span class="spacer"></span>`)

      // type-specific rendering
      var link
      if (entry.type == 'directory') {
        // modify the last spacer to have an arrow in it
        let icon = isOpen ? 'icon icon-down-dir' : 'icon icon-right-dir'
        spacers[depth].appendChild(yo`<span class=${icon} onclick=${e => opts.onToggleNodeExpanded(node)}></span>`)
        link = yo`<a onclick=${e => opts.onToggleNodeExpanded(node)}>${entry.name}</a>`
      } else {
        link = yo`<a href="dat://${tree.entry.key}/${entry.path}">${entry.name}</a>`
      }

      // render self
      var isDotfile = entry.name.charAt(0) == '.'
      els.push(yo`<div class=${'fl-row '+entry.type+(isDotfile?' dotfile':'')}>
        <div class="fl-name">${spacers}${link}</div>
        <div class="fl-updated">${entry.mtime ? niceDate(entry.mtime) : ''}</div>
        <div class="fl-size">${entry.length ? prettyBytes(entry.length) : ''}</div>
      </div>`)
    }

    // render children
    if (node.children && isOpen) {
      const toObj = key => node.children[key]
      els = els.concat(Object.keys(node.children).map(toObj).sort(treeSorter).map(child => renderNode(child, depth + 1)))
    }

    return els
  }

  // render
  var startDepth = (opts.showRoot) ? 0 : -1 // start from -1 to skip root
  return yo`<div class="files-list">${head}<div class="fl-rows">${renderNode(tree, startDepth)}</div></div>`
}

function splitPath (str) {
  if (!str || typeof str != 'string') return []
  return str
    .replace(/(^\/*)|(\/*$)/g, '') // skip any preceding or following slashes
    .split('/')
}

function treeSorter (a, b) {
  // directories at top
  if (a.entry.type == 'directory' && b.entry.type != 'directory')
    return -1
  if (a.entry.type != 'directory' && b.entry.type == 'directory')
    return 1

  // by name
  return a.entry.name.localeCompare(b.entry.name)
}