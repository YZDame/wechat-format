var WxRenderer = function (opts) {
  this.opts = opts
  var ENV_USE_REFERENCES = true
  var ENV_STETCH_IMAGE = true

  var footnotes = []
  var footnoteindex = 0
  var styleMapping = null

  var FONT_FAMILY_MONO = "Operator Mono, Consolas, Monaco, Menlo, monospace"

  var COPY = function (base, extend) { return Object.assign({}, base, extend)}

  this.buildTheme = function (themeTpl) {
    var mapping = {}
    var base = COPY(themeTpl.BASE, {
      'font-family': this.opts.fonts,
      'font-size': this.opts.size
    })
    var base_block = COPY(base, themeTpl.BASE_BLOCK)
    for (var ele in themeTpl.inline) {
      if (themeTpl.inline.hasOwnProperty(ele)) {
        mapping[ele] = COPY({}, themeTpl.inline[ele])
      }
    }
    mapping.codespan['font-family'] = FONT_FAMILY_MONO
    for (var ele in themeTpl.block) {
      if (themeTpl.block.hasOwnProperty(ele)) {
        mapping[ele] = COPY(base_block, themeTpl.block[ele])
      }
    }
    return mapping
  }

  var S = function (tokenName, dict) {
    var arr = []
    dict = dict || styleMapping[tokenName]
    for (const key in dict) {
      arr.push(key + ':' + dict[key])
    }
    return 'style="' + arr.join(';') + '"'
  }

  var addFootnote = function (title, link) {
    footnoteindex += 1
    footnotes.push([footnoteindex, title, link])
    return footnoteindex
  }

  this.buildFootnotes = function () {
    var footnoteArray = footnotes.map(function (x) {
      if (x[1] === x[2]) {
        return '<code style="font-size: 90%; opacity: 0.6;">[' + x[0] + ']</code>: <i>'  + x[1] +'</i><br/>'
      }
      return '<code style="font-size: 90%; opacity: 0.6;">[' + x[0] + ']</code> ' + x[1] + ': <i>'  + x[2] +'</i><br/>'
    })
    return '<h3 ' + S('h3') + '>References</h3><p ' + S('footnotes') + '>'  + footnoteArray.join('\n') + '</p>'
  }

  this.setOptions = function (newOpts) {
    this.opts = COPY(this.opts, newOpts)
  }

  this.hasFootnotes = function () {
    return footnotes.length !== 0
  }

  this.getRenderer = function () {
    footnotes = []
    footnoteindex = 0
  
    styleMapping = this.buildTheme(this.opts.theme)
    var renderer = new marked.Renderer()
    FuriganaMD.register(renderer);
  
    renderer.heading = function (text, level) {
      var tag = 'h' + level
      return '<' + tag + ' ' + S(tag) + '>' + text + '</' + tag + '>'
    }
    renderer.paragraph = function (text) {
      return '<p ' + S('p') + '>' + text + '</p>'
    }
    renderer.blockquote = function (text) {
      return '<blockquote ' + S('blockquote') + '>' + text + '</blockquote>'
    }
    renderer.code = function (text, infostring) {
      text = text.replace(/</g, "&lt;")
      text = text.replace(/>/g, "&gt;")
  
      var lines = text.split('\n')
      var codeLines = []
      var numbers = []
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        codeLines.push('<code><span class="code-snippet_outer">' + (line || '<br>') + '</span></code>')
        numbers.push('<li></li>')
      }
      var lang = infostring || ''
      return '<section class="code-snippet__fix code-snippet__js" style="background-color:rgba(0,0,0,0.03);border:1px solid #f0f0f0;border-radius:2px;color:#333">'
        + '<ul class="code-snippet__line-index code-snippet__js">' + numbers.join('')+'</ul>'
        + '<pre class="code-snippet__js" data-lang="'+lang+'">' 
          + codeLines.join('')
        + '</pre></section>'
    }
    renderer.codespan = function (text, infostring) {
      return '<code ' + S('codespan') + '>' + text + '</code>'
    }
    renderer.listitem = function (text) {
      return '<span ' + S('listitem') + '><span style="margin-right: 10px;"><%s/></span>' + text + '</span>';
    }
    renderer.list = function (text, ordered, start) {
      var segments = text.split('<%s/>');
      if (!ordered) {
        text = segments.join('•');
        return '<p ' + S('ul') + '>' + text + '</p>';
      }
      text = segments[0];
      for (var i = 1; i < segments.length; i++) {
        text = text + i + '.' + segments[i];
      }
      return '<p ' + S('ol') + '>' + text + '</p>';
    }
    renderer.image = function (href, title, text) {
      return '<img ' + S(ENV_STETCH_IMAGE ? 'image' : 'image_org') + ' src="' + href + '" title="'+title+'" alt="'+text+'"/>'
    }
    renderer.link = function (href, title, text) {
      if (href.indexOf('https://mp.weixin.qq.com') === 0) {
        return '<a href="' + href +'" title="' + (title || text) + '" ' + S('wx_link') +'>' + text + '</a>'; 
      }else if( href === text){
        return text;
      } else {
        if (ENV_USE_REFERENCES) {
          var ref = addFootnote(title || text, href)
          return '<span ' + S('link') + '>' + text + '<sup>['+ref+']</sup></span>'; 
        } else {
          return '<a href="' + href +'" title="' + (title || text) + '" ' + S('link') + '>' + text + '</a>'; 
        }
      }
    }
    renderer.strong = function (text) {
      return '<strong ' + S('strong') + '>' + text + '</strong>'
    }
    renderer.em = function (text) {
      return '<em ' + S('em') + '>' + text + '</em>'
    }
    renderer.table = function (header, body) {
      return '<table ' + S('table') + '><thead>' + header + '</thead><tbody>' + body + '</tbody></table>';
    }
    renderer.tablecell = function (text, flags) {
      var tag = flags.header ? 'th' : 'td'
      var style = COPY(styleMapping[tag], flags.align ? { 'text-align': flags.align } : {})
      return '<' + tag + ' ' + S(tag, style) + '>' + text + '</' + tag + '>'
    }
    renderer.hr = function () {
      return '<hr ' + S('hr') + '>'
    }
    return renderer
  }
}