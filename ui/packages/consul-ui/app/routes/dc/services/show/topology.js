import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';
import { set, get, action } from '@ember/object';

export default class TopologyRoute extends Route {
  @service('ui-config') config;
  @service('env') env;
  @service('data-source/service') data;
  @service('repository/intention') repo;

  @action
  async createIntention(source, destination) {
    // intentions will be a proxy object
    let intentions = await this.intentions;
    let intention = intentions.find(item => {
      return (
        item.Datacenter === source.Datacenter &&
        item.SourceName === source.Name &&
        item.SourceNS === source.Namespace &&
        item.DestinationName === destination.Name &&
        item.DestinationNS === destination.Namespace
      );
    });
    if (typeof intention === 'undefined') {
      intention = this.repo.create({
        Datacenter: source.Datacenter,
        SourceName: source.Name,
        SourceNS: source.Namespace || 'default',
        DestinationName: destination.Name,
        DestinationNS: destination.Namespace || 'default',
      });
    }
    set(intention, 'Action', 'allow');
    await this.repo.persist(intention);
    this.refresh();
  }

  afterModel(model, transition) {
    this.intentions = this.data.source(
      uri => uri`/${model.nspace}/${model.dc.Name}/intentions/for-service/${model.slug}`
    );
  }

  async deactivate(transition) {
    const intentions = await this.intentions;
    intentions.destroy();
  }

  async model() {
    const parent = this.routeName
      .split('.')
      .slice(0, -1)
      .join('.');
    const model = this.modelFor(parent);
    const dc = get(model, 'dc');
    const nspace = get(model, 'nspace');

    const item = get(model, 'items.firstObject');
    if (get(item, 'IsMeshOrigin')) {
      let kind = get(item, 'Service.Kind');
      if (typeof kind === 'undefined') {
        kind = '';
      }
      model.topology = await this.data.source(
        uri => uri`/${nspace}/${dc.Name}/topology/${model.slug}/${kind}`
      );
    }
    return {
      ...model,
      hasMetricsProvider: !!this.config.get().metrics_provider,
      isRemoteDC: this.env.var('CONSUL_DATACENTER_LOCAL') !== this.modelFor('dc').dc.Name,
    };
  }

  setupController(controller, model) {
    super.setupController(...arguments);
    controller.setProperties(model);
  }
}
