const svgdom = require('svgdom-css')
const Chartist = require('chartist')
const fs = require('fs')

const FUNCTION = new Map([
  ['bar', Chartist.Bar],
  ['line', Chartist.Line],
  ['pie', Chartist.Pie],
])

function defaults(o = {}) {
  const options = { width: 1200, height: 600, ...o.options }
  const h = Math.min(options.width, options.height)
  const title = {
    x: 0,
    y: 0,
    height: 0.08 * h,
    'font-size': `${0.03 * h}px`,
    'font-family': 'Verdana',
    'font-weight': 'bold',
    fill: 'crimson',
    'text-anchor': 'middle',
    role: 'caption',
    ...o.title,
  }
  const subtitle = {
    x: 0,
    y: 0,
    height: 0.04 * h,
    'font-size': `${0.02 * h}px`,
    'font-family': 'Verdana',
    'font-weight': 'bold',
    fill: 'indianred',
    'text-anchor': 'middle',
    ...o.subtitle,
  }
  return { ...o, options, title, subtitle }
}

/**
 * @params type                   {string} chart type: bar, line, pie
 * @params chartData              {object} Chartist's data. The data object used to pie/bar/line chart
 * @params [opts]                 {object} optional options
 * @params [opts.options]         {object} Chartist's options
 * @params [opts.resOptions]      {array}  Chartist's responsiveOptions
 * @params [opts.css]             {string} Custom CSS will be appended to Chartist's CSS
 * @params [opts.onDraw]          {Function} Chartist's 'draw' event listener
 * @params [opts.title]           {object} chart's title options (height\width\fill etc). Title text is passed in by chartData.title
 * @params [opts.subtitle]        {object} chart's subtitle options (height\width\fill etc). Subtitle text is passed in by chartData.subtitle
 */
module.exports = function chart(type, chartData, opts = {}) {
  const CSSPATH = require.resolve('chartist/dist/chartist.min.css')
  const css = opts.css || ''
  const STYLE = css + fs.readFileSync(CSSPATH, 'utf8')
  svgdom(STYLE)

  opts = defaults(opts)
  const resOptions = opts.resOptions || []

  const w = opts.options.width
  const h = opts.options.height
  const th = opts.title.height
  const sth = opts.subtitle.height

  const div = document.createElement('div')
  document.querySelector('svg').appendChild(div)
  const chartist = new (FUNCTION.get(type))(div, chartData, opts.options, opts.resOptions || [])
  return new Promise(fres => {
    chartist
      .on('draw', data => {
        if (opts.onDraw && typeof opts.onDraw === 'function') {
          opts.onDraw(data)
        }
      })
      .on('created', data => {
        const svg = div.querySelector('svg')
        const ttl = title(chartData.title, 0.5 * w, 0.6 * th, opts.title)
        const stl = title(chartData.subtitle, 0.5 * w, th + 0.6 * sth, opts.subtitle)
        // if (chartData.title || chartData.subtitle) {
        //     for (var e of div.querySelectorAll('svg > g'))
        //         e.setAttribute('transform', `translate(0, ${th + sth})`);
        // }

        // svg.setAttribute('height', h + th + sth + 0.2 * h);
        svg.setAttribute('height', h + 40)
        svg.setAttribute('style', '')
        svg.setAttribute('viewBox', `0 0 ${w} ${h + 40}`)
        svg.appendChild(ttl)
        svg.appendChild(stl)
        window.setComputedStyle(div)
        const txt = div.innerHTML
        div.parentNode.removeChild(div)
        fres(txt)
      })
  })

  function tag(nam, cnt = '', att = {}) {
    const z = document.createElement(nam)
    for (const k in att) z.setAttribute(k, att[k])
    z.textContent = cnt
    return z
  }

  function title(txt, x = 0, y = 0, o = {}) {
    o.x += x
    o.y += y
    return tag('text', txt, o)
  }
}
