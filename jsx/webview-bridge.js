/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * Modified by Ali Najafizadeh (github.com/alinz)
 *
 * @flow
 */
'use strict';

var ActivityIndicatorIOS = require('ActivityIndicatorIOS');
var EdgeInsetsPropType = require('EdgeInsetsPropType');
var React = require('React');
var StyleSheet = require('StyleSheet');
var Text = require('Text');
var View = require('View');

var invariant = require('invariant');
var keyMirror = require('keyMirror');
var requireNativeComponent = require('requireNativeComponent');

var PropTypes = React.PropTypes;
var WebViewExManager = require('NativeModules').WebViewExManager;

var BGWASH = 'rgba(255,255,255,0.8)';
var RCT_WEBVIEW_REF = 'webviewex';

var WebViewState = keyMirror({
  IDLE: null,
  LOADING: null,
  ERROR: null,
});

var NavigationType = {
  click: WebViewExManager.NavigationType.LinkClicked,
  formsubmit: WebViewExManager.NavigationType.FormSubmitted,
  backforward: WebViewExManager.NavigationType.BackForward,
  reload: WebViewExManager.NavigationType.Reload,
  formresubmit: WebViewExManager.NavigationType.FormResubmitted,
  other: WebViewExManager.NavigationType.Other,
};

type ErrorEvent = {
  domain: any;
  code: any;
  description: any;
}

type Event = Object;

var defaultRenderLoading = () => (
  <View style={styles.loadingView}>
    <ActivityIndicatorIOS />
  </View>
);
var defaultRenderError = (errorDomain, errorCode, errorDesc) => (
  <View style={styles.errorContainer}>
    <Text style={styles.errorTextTitle}>
      Error loading page
    </Text>
    <Text style={styles.errorText}>
      {'Domain: ' + errorDomain}
    </Text>
    <Text style={styles.errorText}>
      {'Error Code: ' + errorCode}
    </Text>
    <Text style={styles.errorText}>
      {'Description: ' + errorDesc}
    </Text>
  </View>
);

var WebView = React.createClass({
  statics: {
    NavigationType: NavigationType,
  },

  propTypes: {
    url: PropTypes.string,
    html: PropTypes.string,
    renderError: PropTypes.func, // view to show if there's an error
    renderLoading: PropTypes.func, // loading indicator to show
    bounces: PropTypes.bool,
    scrollEnabled: PropTypes.bool,
    automaticallyAdjustContentInsets: PropTypes.bool,
    shouldInjectAJAXHandler: PropTypes.bool,
    contentInset: EdgeInsetsPropType,
    onNavigationStateChange: PropTypes.func,
    startInLoadingState: PropTypes.bool, // force WebViewEx to show loadingView on first load
    style: View.propTypes.style,
    /**
     * Used for android only, JS is enabled by default for WebViewEx on iOS
     */
    javaScriptEnabledAndroid: PropTypes.bool,
  },

  getInitialState: function() {
    return {
      viewState: WebViewState.IDLE,
      lastErrorEvent: (null: ?ErrorEvent),
      startInLoadingState: true,
    };
  },

  componentWillMount: function() {
    if (this.props.startInLoadingState) {
      this.setState({viewState: WebViewState.LOADING});
    }
  },

  render: function() {
    var otherView = null;

    if (this.state.viewState === WebViewState.LOADING) {
      otherView = (this.props.renderLoading || defaultRenderLoading)();
    } else if (this.state.viewState === WebViewState.ERROR) {
      var errorEvent = this.state.lastErrorEvent;
      invariant(
        errorEvent != null,
        'lastErrorEvent expected to be non-null'
      );
      otherView = (this.props.renderError || defaultRenderError)(
        errorEvent.domain,
        errorEvent.code,
        errorEvent.description
      );
    } else if (this.state.viewState !== WebViewState.IDLE) {
      console.error(
        'WebViewEx invalid state encountered: ' + this.state.loading
      );
    }

    var webViewStyles = [styles.container, styles.webView, this.props.style];
    if (this.state.viewState === WebViewState.LOADING ||
      this.state.viewState === WebViewState.ERROR) {
      // if we're in either LOADING or ERROR states, don't show the webView
      webViewStyles.push(styles.hidden);
    }

    var webView =
      <WebViewEx
        ref={RCT_WEBVIEW_REF}
        key="webViewKey"
        style={webViewStyles}
        url={this.props.url}
        html={this.props.html}
        bounces={this.props.bounces}
        scrollEnabled={this.props.scrollEnabled}
        shouldInjectAJAXHandler={this.props.shouldInjectAJAXHandler}
        contentInset={this.props.contentInset}
        automaticallyAdjustContentInsets={this.props.automaticallyAdjustContentInsets}
        onLoadingStart={this.onLoadingStart}
        onLoadingFinish={this.onLoadingFinish}
        onLoadingError={this.onLoadingError}
      />;

    return (
      <View style={styles.container}>
        {webView}
        {otherView}
      </View>
    );
  },

  goForward: function() {
    WebViewExManager.goForward(this.getWebWiewHandle());
  },

  goBack: function() {
    WebViewExManager.goBack(this.getWebWiewHandle());
  },

  reload: function() {
    WebViewExManager.reload(this.getWebWiewHandle());
  },

  onMessage: function (cb) {
    WebViewExManager.onMessage(this.getWebWiewHandle(), cb);
  },

  send: function (message) {
    WebViewExManager.send(this.getWebWiewHandle(), message);
  },

  /**
   * We return an event with a bunch of fields including:
   *  url, title, loading, canGoBack, canGoForward
   */
  updateNavigationState: function(event: Event) {
    if (this.props.onNavigationStateChange) {
      this.props.onNavigationStateChange(event.nativeEvent);
    }
  },

  getWebWiewHandle: function(): any {
    return React.findNodeHandle(this.refs[RCT_WEBVIEW_REF]);
  },

  onLoadingStart: function(event: Event) {
    this.updateNavigationState(event);
  },

  onLoadingError: function(event: Event) {
    event.persist(); // persist this event because we need to store it
    console.error('Encountered an error loading page', event.nativeEvent);

    this.setState({
      lastErrorEvent: event.nativeEvent,
      viewState: WebViewState.ERROR
    });
  },

  onLoadingFinish: function(event: Event) {
    this.setState({
      viewState: WebViewState.IDLE,
    });
    this.updateNavigationState(event);
  },
});

var WebViewEx = requireNativeComponent('WebViewEx', WebView);

var styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: BGWASH,
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 2,
  },
  errorTextTitle: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 10,
  },
  hidden: {
    height: 0,
    flex: 0, // disable 'flex:1' when hiding a View
  },
  loadingView: {
    backgroundColor: BGWASH,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  webView: {
    backgroundColor: '#ffffff',
  }
});

module.exports = WebView;
