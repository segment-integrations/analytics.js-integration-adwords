'use strict';

var Analytics = require('@segment/analytics.js-core').constructor;
var integration = require('@segment/analytics.js-integration');
var tester = require('@segment/analytics.js-integration-tester');
var AdWords = require('../lib/');
var sandbox = require('@segment/clear-env');

describe('AdWords', function() {
  var adwords;
  var analytics;
  var options = {
    conversionId: 978352801,
    labelMap: [
      {
        event: 'signup',
        label: '-kGkCJ_TsgcQofXB0gM'
      },
      {
        event: 'login',
        label: 'QbThCM_zogcQofXB0gM'
      },
      {
        event: 'play',
        label: 'b91fc77f'
      }
    ]
  };

  beforeEach(function() {
    analytics = new Analytics();
    adwords = new AdWords(options);
    analytics.use(AdWords);
    analytics.use(tester);
    analytics.add(adwords);
  });

  afterEach(function() {
    analytics.restore();
    analytics.reset();
    adwords.reset();
    sandbox();
  });

  it('should have the correct settings', function() {
    analytics.compare(AdWords, integration('AdWords')
      .option('conversionId', '')
      .option('remarketing', false));
  });

  describe('loading', function() {
    it('should load', function(done) {
      analytics.load(adwords, done);
    });
  });

  describe('after loading', function() {
    beforeEach(function(done) {
      analytics.once('ready', done);
      analytics.initialize();
      analytics.page();
    });

    describe('#page', function() {
      beforeEach(function() {
        analytics.stub(window, 'google_trackConversion');
      });

      it('should not load remarketing if option is not on', function() {
        adwords.options.remarketing = false;
        analytics.page();
        analytics.calledOnce(window.google_trackConversion);
        analytics.deepEqual(window.google_trackConversion.args[0], [{
          google_conversion_id: options.conversionId,
          google_custom_params: {},
          google_remarketing_only: false
        }]);
      });

      it('should fire additional remarketing tag if option is on', function() {
        adwords.options.remarketing = true;
        analytics.page();
        analytics.calledTwice(window.google_trackConversion);
        // fire conversion tag first
        analytics.deepEqual(window.google_trackConversion.args[0], [{
          google_conversion_id: options.conversionId,
          google_custom_params: {},
          google_remarketing_only: false 
        }]);
        // then fire remarketing with props
        analytics.deepEqual(window.google_trackConversion.args[1], [{
          google_conversion_id: options.conversionId,
          google_custom_params: {
            path: window.location.pathname,
            referrer: document.referrer,
            search: '',
            title: '',
            url: window.location.href
          },
          google_remarketing_only: true
        }]);
      });
    });

    describe('#track', function() {
      beforeEach(function() {
        analytics.stub(window, 'google_trackConversion');
      });

      it('should not send any tags if event is not defined', function() {
        analytics.track('toString', {});
        analytics.didNotCall(window.google_trackConversion);
      });

      it('should send conversion tag if event is defined', function() {
        analytics.track('signup', {});
        analytics.called(window.google_trackConversion, {
          google_conversion_id: options.conversionId,
          google_custom_params: {},
          google_conversion_language: 'en',
          google_conversion_format: '3',
          google_conversion_color: 'ffffff',
          google_conversion_label: options.labelMap[0].label,
          google_conversion_value: 0,
          google_remarketing_only: false
        });
      });

      it('should use mapping specific IDs if provided', function() {
        adwords.options.labelMap = [
          {
            event: 'signup',
            label: '-kGkCJ_TsgcQofXB0gM',
            conversionId: 431
          },
          {
            event: 'login',
            label: 'QbThCM_zogcQofXB0gM',
            conversionId: 367
          },
          {
            event: 'play',
            label: 'b91fc77f',
            conversionId: 109
          }];
        analytics.track('signup', {});
        analytics.called(window.google_trackConversion, {
          google_conversion_id: 431,
          google_custom_params: {},
          google_conversion_language: 'en',
          google_conversion_format: '3',
          google_conversion_color: 'ffffff',
          google_conversion_label: options.labelMap[0].label,
          google_conversion_value: 0,
          google_remarketing_only: false
        });
      });

      it('should use whitelisted event-specific ID when provided', function() {
        adwords.options.whitelist = { 'danny mcbride is funny': 4879235 };
        analytics.track('danny mcbride is funny', { revenue: 90 });
        analytics.calledOnce(window.google_trackConversion);
        analytics.deepEqual(window.google_trackConversion.args[0], [{
          google_conversion_id: 4879235,
          google_custom_params: { revenue: 90 },
          google_remarketing_only: true
        }]);
      })

      it('should send revenue', function() {
        analytics.track('login', { revenue: 90 });
        analytics.called(window.google_trackConversion, {
          google_conversion_id: options.conversionId,
          google_custom_params: {},
          google_conversion_language: 'en',
          google_conversion_format: '3',
          google_conversion_color: 'ffffff',
          google_conversion_label: options.labelMap[1].label,
          google_conversion_value: 90,
          google_remarketing_only: false
        });
      });

      it('should always send google_remarketing_only false for conversion tags', function() {
        adwords.options.remarketing = true;
        analytics.track('login', { revenue: 90 });
        analytics.called(window.google_trackConversion, {
          google_conversion_id: options.conversionId,
          google_custom_params: {},
          google_conversion_language: 'en',
          google_conversion_format: '3',
          google_conversion_color: 'ffffff',
          google_conversion_label: options.labelMap[1].label,
          google_conversion_value: 90,
          google_remarketing_only: false
        });
      });

      it('should send only the conversion tag if remarketing is false', function() {
        adwords.options.remarketing = false;
        analytics.track('login', { revenue: 90 });
        analytics.calledOnce(window.google_trackConversion);
        analytics.deepEqual(window.google_trackConversion.args[0], [{
          google_conversion_id: options.conversionId,
          google_custom_params: {},
          google_conversion_language: 'en',
          google_conversion_format: '3',
          google_conversion_color: 'ffffff',
          google_conversion_label: options.labelMap[1].label,
          google_conversion_value: 90,
          google_remarketing_only: false
        }]);
      });

      it('should send only the remarketing tag if no conversions are mapped but is whitelisted', function() {
        adwords.options.whitelist = { 'danny mcbride is funny': null };
        analytics.track('danny mcbride is funny', { revenue: 90 });
        analytics.calledOnce(window.google_trackConversion);
        analytics.deepEqual(window.google_trackConversion.args[0], [{
          google_conversion_id: options.conversionId,
          google_custom_params: { revenue: 90 },
          google_remarketing_only: true
        }]);
      });

      it('should send both conversion and remarketing tag if remarketing is true', function() {
        adwords.options.remarketing = true;
        analytics.track('login', { revenue: 90, hello: 'foo' });
        analytics.calledTwice(window.google_trackConversion);
        analytics.deepEqual(window.google_trackConversion.args[0], [{
          google_conversion_id: options.conversionId,
          google_custom_params: { hello: 'foo' },
          google_conversion_language: 'en',
          google_conversion_format: '3',
          google_conversion_color: 'ffffff',
          google_conversion_label: options.labelMap[1].label,
          google_conversion_value: 90,
          google_remarketing_only: false
        }]);
        analytics.deepEqual(window.google_trackConversion.args[1], [{
          google_conversion_id: options.conversionId,
          google_custom_params: { hello: 'foo' },
          google_remarketing_only: true
        }]);
      });

      it('should not double send remarketing tag as a standalone if it was already sent with conversion tag', function() {
        adwords.options.remarketing = true;
        analytics.track('login', { revenue: 90, hello: 'foo' });
        // It would be called three times if it sent duplicate
        analytics.calledTwice(window.google_trackConversion);
      });
    });
  });
});
