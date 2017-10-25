'use strict';

/**
 * Module dependencies.
 */

var integration = require('@segment/analytics.js-integration');
var each = require('@ndhoule/each');
var when = require('do-when');

/**
 * Expose `AdWords`.
 */

var AdWords = module.exports = integration('AdWords')
  .option('conversionId', '')
  .option('remarketing', false)
  .option('whitelist', {})
  .option('labelMap', [])
  .tag('<script src="//www.googleadservices.com/pagead/conversion_async.js">');

/**
 * Initialize.
 *
 * @api public
 */

AdWords.prototype.initialize = function() {
  var loaded = this.loaded;
  var ready = this.ready;
  this.load(function() {
    when(loaded, ready);
  });
};

/**
 * Loaded.
 *
 * @api private
 * @return {boolean}
 */

AdWords.prototype.loaded = function() {
  return !!(document.body && window.google_trackConversion);
};

/**
 * Page.
 *
 * https://support.google.com/adwords/answer/3111920#standard_parameters
 * https://support.google.com/adwords/answer/3103357
 * https://developers.google.com/adwords-remarketing-tag/asynchronous/
 * https://developers.google.com/adwords-remarketing-tag/parameters
 *
 * @api public
 * @param {Page} page
 */

AdWords.prototype.page = function(page) {
  // Remarketing option can support both Adwords' "static" or "dynamic" remarketing tags
  // Difference is static you don't need to send props under `google_custom_params`
  var remarketing = this.options.remarketing;
  var id = this.options.conversionId;
  var props = page.properties();

  // Conversion tag
  window.google_trackConversion({
    google_conversion_id: id,
    google_custom_params: {},
    google_remarketing_only: false // this ensures that this is a conversion tag
  });

  // Remarketing tag (must be sent in _addition_ to any conversion tags)
  // https://developers.google.com/adwords-remarketing-tag/
  if (remarketing) {
    window.google_trackConversion({
      google_conversion_id: id,
      google_custom_params: props,
      google_remarketing_only: true // this ensures that this is a remarketing tag
    });
  }
};

/**
 * Track.
 *
 * @api public
 * @param {Track}
 */

AdWords.prototype.track = function(track) {
  var self = this;
  var props = track.properties();
  var remarketing = this.options.remarketing;
  var labelMap = this.options.labelMap;
  var revenue = track.revenue() || 0;
  var remarketingSent = {}; // for each conversion id tracks whether a remarketing tag has been sent yet

  if (labelMap) { // if labelmap exists then the new metadata schema is being used
    labelMap.forEach(function(mapping) {
      if (typeof mapping.value.eventName !== 'string' || typeof track.event() !== 'string') return;
      
      if (mapping.value.eventName.toLowerCase() !== track.event().toLowerCase()) return;
      var id = mapping.value.conversionId || self.options.conversionId;  // customer can either specify one global conversion id or one per event<->label mapping
      delete props.revenue;

      // Fire conversion tag
      window.google_trackConversion({
        google_conversion_id: id,
        google_custom_params: props,
        google_conversion_language: 'en',
        google_conversion_format: '3',
        google_conversion_color: 'ffffff',
        google_conversion_label: mapping.value.label,
        google_conversion_value: revenue,
        google_remarketing_only: false // ensure this is a conversion tag
      });

      // Fire remarketing tag
      if (!(id in remarketingSent) && remarketing) {
        window.google_trackConversion({
          google_conversion_id: id,
          google_custom_params: props, // do not send PII here!
          google_remarketing_only: true // ensure this is a remarketing tag
        });
        remarketingSent[id] = true;
      }
    });

    var whitelist = this.options.whitelist;

    whitelist.forEach(function(listing) {
      if (typeof listing.value.eventName !== 'string' || typeof track.event() !== 'string') return;
      if (listing.value.eventName.toLowerCase() !== track.event().toLowerCase()) return;

      var conversionIds = listing.value.conversionIds;
      if (conversionIds.length < 1) conversionIds.push(self.options.conversionId);

      conversionIds.forEach(function(conversionId) {
        if (conversionId in remarketingSent) return;

        window.google_trackConversion({
          google_conversion_id: conversionId,
          google_custom_params: props, // do not send PII here!
          google_remarketing_only: true // ensure this is a remarketing tag
        });
      });
    });
  } 
  // DELETE BELOW AND TAKE ABOVE OUT OF IF CLAUSE, only exists for metadata cutover
  else {  // eslint-disable-line
    var id = this.options.conversionId;
    var events = this.events(track.event());
    // Check if this is a whitelisted event for standalone remarketing tag
    var whitelisted = this.options.whitelist.indexOf(track.event()) > -1;
    var sentAlready = false;
  
    each(function(label) {
      delete props.revenue;
      // Fire conversion tag
      window.google_trackConversion({
        google_conversion_id: id,
        google_custom_params: props,
        google_conversion_language: 'en',
        google_conversion_format: '3',
        google_conversion_color: 'ffffff',
        google_conversion_label: label,
        google_conversion_value: revenue,
        google_remarketing_only: false // ensure this is a conversion tag
      });
      // Fire remarketing tag
      if (!sentAlready && remarketing) {
        window.google_trackConversion({
          google_conversion_id: id,
          google_custom_params: props, // do not send PII here!
          google_remarketing_only: true // ensure this is a remarketing tag
        });
        sentAlready = true;
      }
    }, events);
  
    if (!sentAlready && whitelisted) {
      window.google_trackConversion({
        google_conversion_id: id,
        google_custom_params: props, // do not send PII here!
        google_remarketing_only: true // ensure this is a remarketing tag
      });
    }
  }
};
