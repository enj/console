/* eslint-disable no-undef, no-unused-vars */

import * as React from 'react';
import * as _ from 'lodash';
import { Map } from 'immutable';
import { connect } from 'react-redux';
import { Helmet } from 'react-helmet';
import * as classNames from 'classnames';

import { ListPage, List, ListHeader, ColHead, ResourceRow } from '../factory';
import { Firehose, NavTitle } from '../utils';
import { AppTypeLogo, CatalogEntryKind, K8sResourceKind, AppTypeKind, ClusterServiceVersionPhase } from './index';
import { createInstallApplicationModal } from '../modals/install-application-modal';
import { k8sCreate } from '../../module/k8s';

export const CatalogAppHeader: React.StatelessComponent<CatalogAppHeaderProps> = (props) => <ListHeader>
  <ColHead {...props} className="col-xs-4" sortField="metadata.name">Name</ColHead>
  <ColHead {...props} className="col-xs-6">Status</ColHead>
  <ColHead {...props} className="col-xs-2">Actions</ColHead>
</ListHeader>;

const stateToProps = ({k8s}, {obj}) => ({
  namespaces: k8s.get('namespaces').toJS(),
  clusterServiceVersions: _.values(k8s.getIn(['clusterserviceversion-v1s', 'data'], Map()).toJS())
    .filter((csv: AppTypeKind) => csv.status !== undefined)
    .filter((csv: AppTypeKind) => csv.metadata.name === obj.metadata.name),
});

export const CatalogAppRow = connect(stateToProps)(
  class extends React.Component<CatalogAppRowProps, CatalogAppRowState> {
    constructor(props) {
      super(props);
      this.state = {...this.propsToState(props), expand: null};
    }

    componentWillReceiveProps(nextProps: CatalogAppRowProps) {
      this.setState(this.propsToState(nextProps));
      if (this.state.expand === null && nextProps.clusterServiceVersions.length > 0) {
        this.setState({expand: this.state.succeeded.length !== nextProps.clusterServiceVersions.length});
      }
    }

    render() {
      const {namespaces, obj, clusterServiceVersions = []} = this.props;

      const Breakdown = (props: {clusterServiceVersions: AppTypeKind[]}) => {
        const {failed, pending, succeeded} = this.state;
        const pluralizeNS = (count: number) => count > 1 ? 'namespaces' : 'namespace';

        if (props.clusterServiceVersions.length === 0) {
          return <span>Not installed</span>;
        }
        if (failed.length > 0) {
          return <div>
            <span style={{marginRight: '5px'}}>
              <i className="fa fa-ban co-error" />
            </span>
            <span>Installation Error </span>
            <span className="text-muted">
              ({`${failed.length} ${pluralizeNS(failed.length)} failed`}{pending.length > 0 && `, ${pending.length} ${pluralizeNS(pending.length)} pending`}{succeeded.length > 0 && `, ${succeeded.length} ${pluralizeNS(succeeded.length)} installed`})
            </span>
          </div>;
        }
        if (pending.length > 0) {
          return <div>
            <span style={{marginRight: '5px'}}>
              <i className="fa fa-spin fa-circle-o-notch co-catalog-spinner--downloading" />
            </span>
            <span>Installing... </span>
            <span className="text-muted">({succeeded.length} of {props.clusterServiceVersions.length} {pluralizeNS(props.clusterServiceVersions.length)})</span>
          </div>;
        }
        if (succeeded.length > 0) {
          return <div>
            <span>Installed </span>
            <span className="text-muted">({succeeded.length} {pluralizeNS(succeeded.length)})</span>
          </div>;
        }
        return <span />;
      };

      const BreakdownDetail = (props: {clusterServiceVersions: AppTypeKind[]}) => {
        const {failed, pending, succeeded} = this.state;

        return <div>
          { succeeded.length !== clusterServiceVersions.length && <div
            style={{width: `${(succeeded.length / props.clusterServiceVersions.length) * 100}%`}}
            className={classNames(
              'co-catalog-install-progress-bar',
              {'co-catalog-install-progress-bar--active': pending.length > 0},
              {'co-catalog-install-progress-bar--failures': failed.length > 0} )}
          /> }
          <ul className="co-catalog-breakdown__ns-list">{ clusterServiceVersions.map((csv, i) => {
            switch (csv.status.phase) {
              case ClusterServiceVersionPhase.CSVPhaseSucceeded:
                return <li className="co-catalog-breakdown__ns-list__item" key={i}>{csv.metadata.namespace}</li>;
              case ClusterServiceVersionPhase.CSVPhaseFailed:
                return <li className="co-catalog-breakdown__ns-list__item co-error" key={i}>{`${csv.metadata.namespace}: ${csv.status.reason}`}</li>;
              case ClusterServiceVersionPhase.CSVPhasePending:
              case ClusterServiceVersionPhase.CSVPhaseInstalling:
                return <li className="co-catalog-breakdown__ns-list__item text-muted" key={i}>{csv.metadata.namespace}</li>;
              default:
                return <li key={i}>{csv.metadata.namespace}</li>;
            }
          }) }</ul>
        </div>;
      };

      return <ResourceRow obj={obj}>
        <div className="co-catalog-app-row" style={{maxHeight: 60 + (this.state.expand ? clusterServiceVersions.length * 50 : 0)}}>
          <div className="col-xs-4">
            <AppTypeLogo icon={_.get(obj.spec, 'icon', [])[0]} version={obj.spec.version} displayName={obj.spec.displayName} provider={obj.spec.provider} />
          </div>
          <div className="col-xs-6">
            <div style={{display: 'flex', alignItems: 'center'}}>
              <Breakdown clusterServiceVersions={clusterServiceVersions} />
              <a style={{marginLeft: 'auto'}} onClick={() => this.setState({expand: !this.state.expand})}>{`${this.state.expand ? 'Hide' : 'Show'} Details`}</a>
            </div>
            <div className={classNames('co-catalog-app-row__details', {'co-catalog-app-row__details--collapsed': !this.state.expand})}>
              <BreakdownDetail clusterServiceVersions={clusterServiceVersions} />
            </div>
          </div>
          <div className="col-xs-2">
            <button
              className="btn btn-primary"
              onClick={() => createInstallApplicationModal({catalogEntry: obj, k8sCreate, namespaces, clusterServiceVersions})}>
              Install
            </button>
          </div>
        </div>
      </ResourceRow>;
    }

    private propsToState(props: CatalogAppRowProps) {
      return {
        failed: props.clusterServiceVersions.filter(csv => _.get(csv, ['status', 'phase']) === ClusterServiceVersionPhase.CSVPhaseFailed),
        pending: props.clusterServiceVersions
          .filter(csv => [ClusterServiceVersionPhase.CSVPhasePending, ClusterServiceVersionPhase.CSVPhaseInstalling].indexOf(_.get(csv, ['status', 'phase'])) !== -1),
        succeeded: props.clusterServiceVersions.filter(csv => _.get(csv, ['status', 'phase']) === ClusterServiceVersionPhase.CSVPhaseSucceeded),
      };
    }
  });

export const CatalogAppList: React.StatelessComponent<CatalogAppListProps> = (props) => (
  <List {...props} Row={CatalogAppRow} Header={CatalogAppHeader} isList={true} label="Applications" />
);

export const CatalogAppsPage: React.StatelessComponent = () => <div>
  {/* Firehoses used here to add resources to Redux store */}
  <Firehose kind="ClusterServiceVersion-v1" isList={true} />
  <Firehose kind="Namespace" isList={true} />
  <ListPage kind="AlphaCatalogEntry-v1" ListComponent={CatalogAppList} filterLabel="Applications by name" title="Applications" showTitle={true} />
</div>;

export const CatalogDetails: React.StatelessComponent = () => <div className="co-catalog-details co-m-pane">
  <div className="co-m-pane__body">
    <div className="col-sm-2 col-xs-12">
      <dl>
        <dt>Name</dt>
        <dd>Open Cloud Services</dd>
      </dl>
    </div>
    <div className="col-sm-2 col-xs-12">
      <dl>
        <dt>Provider</dt>
        <dd>CoreOS, Inc</dd>
      </dl>
    </div>
  </div>
  <div className="co-m-pane__body-section--bordered">
    <CatalogAppsPage />
  </div>
</div>;

export const CatalogsDetailsPage: React.StatelessComponent = () => <div>
  <Helmet>
    <title>Open Cloud Services</title>
  </Helmet>
  <NavTitle detail={true} title="Open Cloud Services" />
  <CatalogDetails />
</div>;

export type CatalogAppRowProps = {
  obj: CatalogEntryKind;
  namespaces: {data: {[name: string]: K8sResourceKind}, loaded: boolean, loadError: Object | string};
  clusterServiceVersions: AppTypeKind[];
};

export type CatalogAppRowState = {
  expand: boolean;
  failed: AppTypeKind[];
  pending: AppTypeKind[];
  succeeded: AppTypeKind[];
};

export type CatalogAppHeaderProps = {

};

export type CatalogAppListProps = {
  loaded: boolean;
  data: CatalogEntryKind[];
  filters: {[key: string]: any};
};

export type CatalogDetailsProps = {

};

// TODO(alecmerdler): Find Webpack loader/plugin to add `displayName` to React components automagically
CatalogDetails.displayName = 'CatalogDetails';
CatalogsDetailsPage.displayName = 'CatalogDetailsPage';
CatalogAppHeader.displayName = 'CatalogAppHeader';
CatalogAppRow.displayName = 'CatalogAppRow';
CatalogAppList.displayName = 'CatalogAppList';
CatalogAppsPage.displayName = 'CatalogAppsPage';