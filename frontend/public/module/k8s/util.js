angular.module('k8s')
.service('k8sUtil', function(_, k8sEnum, urlSvc) {
  'use strict';

  // TODO (sym3tri): refector this depencency once coreos-web is split up.
  this.parseURL = urlSvc.parse;

  this.findByName = function(list, name) {
    return _.find(list, function(item) {
      return item.metadata && item.metadata.name === name;
    });
  };

  function uidPredicate(uid) {
    return function(item) {
      return item.metadata && item.metadata.uid === uid;
    };
  }

  this.findIndexByUID = function(list, uid) {
    return _.findIndex(list, uidPredicate(uid));
  };

  this.findByUID = function(list, uid) {
    return _.find(list, uidPredicate(uid));
  };

  this.getKindEnumById = function(id) {
    return _.find(k8sEnum.Kind, { id: id});
  };

  // Set all named properties of object to null if empty.
  this.nullifyEmpty = function(obj, props) {
    props.forEach(function(p) {
      if (_.isEmpty(obj[p])) {
        obj[p] = null;
      }
    });
  };

  this.deleteProps = (obj, fn) => {
    _.forEach(obj, function(val, key) {
      if (fn(val)) {
        delete obj[key];
      }
    });
    return obj;
  };

  this.deleteNulls = (obj) => {
    this.deleteProps(obj, _.isNull);
    return obj;
  };

  // The detail page link of a resource.
  this.getLink = (resource, kind) => {
    var meta, path = '';
    if (!resource || !resource.metadata) {
      return '';
    }
    meta = resource.metadata;
    if (meta.namespace) {
      path = 'ns/' + meta.namespace + '/';
    }
    return path + kind.path + '/' + meta.name;
  };

  // The edit page link of a resource.
  this.getEditLink = (resource, kind) => {
    var link = this.getLink(resource, kind);
    if (!link) {
      return '';
    }
    return link + '/edit';
  };
});
