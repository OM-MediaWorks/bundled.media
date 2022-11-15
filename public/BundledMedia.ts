import { stream } from 'https://esm.sh/ndjson-rxjs';
import { select } from './rxjs-form-elements/select.ts'
import { input } from './rxjs-form-elements/input.ts'
import { langcode } from './rxjs-form-elements/langcode.ts'
import { ajax } from 'https://esm.sh/rxjs@7.5.7/ajax'
import { map, combineLatestWith, fromEvent, filter, from, tap, bufferCount, startWith, Observable } from 'https://esm.sh/rxjs@7.5.7'
import { html, render } from 'https://esm.sh/uhtml'

export type Filters = {
  search: string, 
  type: Array<string>, 
  category: Array<string>, 
  source: Array<string>, 
  langCode: Array<string>
  limit: number
}

export class BundledMedia {

  #host: string
  data: Map<string | number, { items: Array<any>, nextUrl: string }> = new Map()

  constructor (host: string) {
    this.#host = host    
  }

  filtersToUrl (filters: Filters) {
    const url = new URL(this.#host)

    for (const [key, value] of Object.entries(filters)) {
      if (value && ['string', 'number'].includes(typeof value)) {
        url.searchParams.set(key, value.toString())
      }      
  
      if (Array.isArray(value)) {
        url.searchParams.set(key, value.join(','))
      }
  }

    return url
  }

  stream (url: string, pageSize = 12) {
    return stream(url).pipe(
      bufferCount(pageSize)
    )
  }

  search (url: string) {
    if (this.data.has(url) && this.data.get(url)) {
      return from([this.data.get(url)!])
    }

    return ajax(url).pipe(
      map((ajaxResponse: any) => {
        const { items, nextUrl } = ajaxResponse.response
        this.data.set(url, ajaxResponse.response)
        return { items, nextUrl }
      })
    )
  }

  pagination (data: Map<string | number, Array<any>>, activeIndex: number) {
    const keys = [...data.keys()]

    const isValid = (page: number) => page > -1 && page <= max

    const button = (index: number, value: string | number, label: string) => {
      return isValid(index) ? html`
        <li class="page-item">
          <a class=${`page-link ${activeIndex === index ? 'active' : ''}`} 
            .value=${[index, value]} href="#">
            ${label}
          </a>
        </li>
      ` : null
    }

    const max = data.size - 1

    const buttons = new Set([
      0, 
      1, 
      2,
      activeIndex - 3,
      activeIndex - 2,
      activeIndex - 1,
      activeIndex,
      activeIndex + 1,
      activeIndex + 2,
      activeIndex + 3,
      max - 2,
      max - 1,
      max
    ].filter(isValid))


    const template = html`
      <ul class="d-flex pagination justify-content-center">
      ${button(0, keys[0], '«')}
      ${button(activeIndex - 1, keys[activeIndex - 1], '‹')}
      ${[...buttons.values()].map(index => button(index, keys[index], (index + 1).toString()))}
      ${button(activeIndex + 1, keys[activeIndex + 1], '›')}
      ${button(max, keys[max], '»')}
      </ul>
    `

    return template
  }

  paginationStream () {
    return fromEvent(document.body, 'click').pipe(
      tap((e: any) => e.preventDefault()),
      filter((e: any) => e.target.closest('.pagination') && e.target.classList.contains('page-link')),
      map((e: any) => e.target.value),
      startWith([0, location.toString()])
    )
  }

  /**
   * Generate filters and a combined stream to act on.
   */
  async filters () {
    const url = new URL(this.#host)

    const limitOptions = [
      { value: 20, label: '20' },
      { value: 40, label: '40' }
    ]

    const { element: searchFilter, stream: searchStream } = input(url.searchParams.get('search') ?? '')
    const { element: typesFilter, stream: typesStream } = await select('/types', url.searchParams.get('type') ?? '')
    const { element: categoriesFilter, stream: categoriesStream } = await select('/categories', url.searchParams.get('category') ?? '')
    const { element: sourcesFilter, stream: sourcesStream } = await select('/sources', url.searchParams.get('source') ?? '')
    const { element: limitFilter, stream: limitStream } = await select(limitOptions, url.searchParams.get('limit') ?? 20)
    const { element: langCodeFilter, stream: langCodeStream } = langcode(url.searchParams.get('langcode') ?? '')

    const filtersStream = searchStream.pipe(combineLatestWith(
      typesStream,
      categoriesStream,
      sourcesStream,
      limitStream,
      langCodeStream,
    )).pipe (
      map(([search, type, category, source, limit, langCode]) => ({ search, type, category, source, limit, langCode })),
    )
    
    filtersStream.subscribe((filters: Filters) => {
      const url = new URL(location.toString().split('?')[0])

      for (const [key, value] of Object.entries(filters)) {
        if (value) {
          url.searchParams.set(key, value.toString())
        }
        else {
          url.searchParams.delete(key)
        }
      }

      history.pushState(null, '', url.toString())
    })

    const template = html`
      <div class="col">
        <label class="form-label">Search</label>
        ${searchFilter}
      </div>

      <div class="col">
        <label class="form-label">Type</label>
        ${typesFilter}
      </div>

      <div class="col">
        <label class="form-label">Category</label>
        ${categoriesFilter}
      </div>

      <div class="col">
        <label class="form-label">Source</label>
        ${sourcesFilter}
      </div>

      <div class="col">
        <label class="form-label">Limit</label>
        ${limitFilter}
      </div>

      <div class="col">
        <label class="form-label">Language</label>
        ${langCodeFilter}
      </div>
    `

    const element = document.createElement('div') as HTMLDivElement & { stream: Observable<Filters> }
    element.classList.add('input-group')
    element.classList.add('mb-3')
    element.stream = filtersStream
    render(element, template)

    return element
  }
}