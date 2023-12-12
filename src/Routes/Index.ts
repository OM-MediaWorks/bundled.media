import { BaseRoute } from './BaseRoute.ts'
import routes from './routes.ts'
export class IndexRoute extends BaseRoute {
  public allowsInteractive = true

  static path = '/'

  static description = `A index containing all the routes this API offers`

  handle (): any {
    return routes
  }

  /**
   * The template for the HyperMedia response
   */
  async template (_variables: { [key: string]: any }): Promise<string> { 
    return await `
      <div class="">
        <ul class="list-group">
        ${routes.filter(route => route.description).map((route) => route.path !== '/' ? `
          <li class="list-group-item">
            <a href="${route.path}">${route.path}</a>
            <br>
            <small>${route.description}</small>
          </li>
        ` : '').join('')}
        </ul>
      </div>
    `
  }
}