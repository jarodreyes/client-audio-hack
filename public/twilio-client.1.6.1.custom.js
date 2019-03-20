/*! twilio-client.js 1.6.1-dev

The following license applies to all parts of this software except as
documented below.

    Copyright 2015 Twilio, inc.
 
    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at
 
        http://www.apache.org/licenses/LICENSE-2.0
 
    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.

This software includes rtcpeerconnection-shim under the following (BSD 3-Clause) license.

    Copyright (c) 2017 Philipp Hancke. All rights reserved.

    Copyright (c) 2014, The WebRTC project authors. All rights reserved.

    Redistribution and use in source and binary forms, with or without
    modification, are permitted provided that the following conditions are
    met:

      * Redistributions of source code must retain the above copyright
        notice, this list of conditions and the following disclaimer.

      * Redistributions in binary form must reproduce the above copyright
        notice, this list of conditions and the following disclaimer in
        the documentation and/or other materials provided with the
        distribution.

      * Neither the name of Philipp Hancke nor the names of its contributors may
        be used to endorse or promote products derived from this software
        without specific prior written permission.

    THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
    "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
    LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
    A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
    HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
    SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
    LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
    DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
    THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
    (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
    OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

 */
/* eslint-disable */
(function(root) {
  var bundle = (function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
'use strict';
module.exports = WebSocket;

},{}],2:[function(require,module,exports){
'use strict';
module.exports = { XMLHttpRequest: XMLHttpRequest };

},{}],3:[function(require,module,exports){
var Device = require('./twilio/device').default;
var instance;
Object.defineProperty(Device, 'instance', {
    get: function () { return instance; },
    set: function (_instance) {
        if (_instance === null) {
            instance = null;
        }
    }
});
Device.destroy = function destroySingleton() {
    instance.destroy();
    bindSingleton();
};
/**
 * Create a new Device instance and bind its functions to the Device static. This maintains
 * backwards compatibility for the Device singleton behavior and will be removed in the next
 * breaking release.
 */
function bindSingleton() {
    instance = new Device();
    Object.getOwnPropertyNames(Device.prototype)
        .filter(function (prop) { return typeof Device.prototype[prop] === 'function'; })
        .filter(function (prop) { return prop !== 'destroy'; })
        .forEach(function (prop) { Device[prop] = Device.prototype[prop].bind(instance); });
}
bindSingleton();
Object.getOwnPropertyNames(instance)
    .filter(function (prop) { return typeof Device.prototype[prop] !== 'function'; })
    .forEach(function (prop) {
    Object.defineProperty(Device, prop, {
        get: function () { return instance[prop]; },
        set: function (_prop) { instance[prop] = _prop; },
    });
});
exports.Device = Device;
exports.PStream = require('./twilio/pstream').PStream;
exports.Connection = require('./twilio/connection').Connection;

},{"./twilio/connection":5,"./twilio/device":7,"./twilio/pstream":11}],4:[function(require,module,exports){
var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var log = require('./log');
var MediaDeviceInfoShim = require('./shims/mediadeviceinfo');
var defaultMediaDevices = require('./shims/mediadevices');
var OutputDeviceCollection = require('./outputdevicecollection');
var util = require('./util');
/**
 * @typedef {Object} EnabledSounds
 * @property {boolean} [incoming=true] - Whether incoming sound should play
 * @property {boolean} [outgoing=true] - Whether outgoing sound should play
 * @property {boolean} [disconnect=true] - Whether disconnect sound should play
 */
/**
 * @class
 * @property {Map<string, MediaDeviceInfo>} availableInputDevices - A
 *   Map of all audio input devices currently available to the browser by their device ID.
 * @property {Map<string, MediaDeviceInfo>} availableOutputDevices - A
 *   Map of all audio output devices currently available to the browser by their device ID.
 * @property {MediaDeviceInfo} inputDevice - The active input device. This will not
 *   initially be populated. Having no inputDevice specified by setInputDevice()
 *   will disable input selection related functionality.
 * @property {boolean} isOutputSelectionSupported - False if the browser does not support
 *   setSinkId or enumerateDevices and Twilio can not facilitate output selection
 *   functionality.
 * @property {boolean} isVolumeSupported - False if the browser does not support
 *   AudioContext and Twilio can not analyse the volume in real-time.
 * @property {OutputDeviceCollection} speakerDevices - The current set of output
 *   devices that call audio ([voice, outgoing, disconnect, dtmf]) is routed through.
 *   These are the sounds that are initiated by the user, or played while the user
 *   is otherwise present at the endpoint. If all specified devices are lost,
 *   this Set will revert to contain only the "default" device.
 * @property {OutputDeviceCollection} ringtoneDevices - The current set of output
 *   devices that incoming ringtone audio is routed through. These are the sounds that
 *   may play while the user is away from the machine or not wearing their
 *   headset. It is important that this audio is heard. If all specified
 *   devices lost, this Set will revert to contain only the "default" device.
 * @property {EnabledSounds} enabledSounds
 * @fires AudioHelper#deviceChange
 */
function AudioHelper(onActiveOutputsChanged, onActiveInputChanged, getUserMedia, options) {
    var _this = this;
    if (!(this instanceof AudioHelper)) {
        return new AudioHelper(onActiveOutputsChanged, onActiveInputChanged, getUserMedia, options);
    }
    EventEmitter.call(this);
    options = Object.assign({
        AudioContext: typeof AudioContext !== 'undefined' && AudioContext,
        mediaDevices: defaultMediaDevices,
        setSinkId: typeof HTMLAudioElement !== 'undefined' && HTMLAudioElement.prototype.setSinkId
    }, options);
    log.mixinLog(this, '[AudioHelper]');
    this.log.enabled = options.logEnabled;
    this.log.warnings = options.logWarnings;
    var availableInputDevices = new Map();
    var availableOutputDevices = new Map();
    var isAudioContextSupported = !!(options.AudioContext || options.audioContext);
    var mediaDevices = options.mediaDevices;
    var isEnumerationSupported = mediaDevices && mediaDevices.enumerateDevices || false;
    var isSetSinkSupported = typeof options.setSinkId === 'function';
    var isOutputSelectionSupported = isEnumerationSupported && isSetSinkSupported;
    var isVolumeSupported = isAudioContextSupported;
    if (options.enabledSounds) {
        addOptionsToAudioHelper(this, options.enabledSounds);
    }
    var audioContext = null;
    var inputVolumeAnalyser = null;
    if (isVolumeSupported) {
        audioContext = options.audioContext || new options.AudioContext();
        inputVolumeAnalyser = audioContext.createAnalyser();
        inputVolumeAnalyser.fftSize = 32;
        inputVolumeAnalyser.smoothingTimeConstant = 0.3;
    }
    var self = this;
    Object.defineProperties(this, {
        _audioContext: {
            value: audioContext
        },
        _getUserMedia: {
            value: getUserMedia
        },
        _inputDevice: {
            value: null,
            writable: true
        },
        _inputStream: {
            value: null,
            writable: true
        },
        _inputVolumeAnalyser: {
            value: inputVolumeAnalyser
        },
        _isPollingInputVolume: {
            value: false,
            writable: true
        },
        _onActiveInputChanged: {
            value: onActiveInputChanged
        },
        _mediaDevices: {
            value: mediaDevices
        },
        _unknownDeviceIndexes: {
            value: {}
        },
        _updateAvailableDevices: {
            value: updateAvailableDevices.bind(null, this)
        },
        availableInputDevices: {
            enumerable: true,
            value: availableInputDevices
        },
        availableOutputDevices: {
            enumerable: true,
            value: availableOutputDevices
        },
        inputDevice: {
            enumerable: true,
            get: function () {
                return self._inputDevice;
            }
        },
        inputStream: {
            enumerable: true,
            get: function () {
                return self._inputStream;
            }
        },
        isVolumeSupported: {
            enumerable: true,
            value: isVolumeSupported
        },
        isOutputSelectionSupported: {
            enumerable: true,
            value: isOutputSelectionSupported
        },
        ringtoneDevices: {
            enumerable: true,
            value: new OutputDeviceCollection('ringtone', availableOutputDevices, onActiveOutputsChanged, isOutputSelectionSupported)
        },
        speakerDevices: {
            enumerable: true,
            value: new OutputDeviceCollection('speaker', availableOutputDevices, onActiveOutputsChanged, isOutputSelectionSupported)
        }
    });
    this.on('newListener', function (eventName) {
        if (eventName === 'inputVolume') {
            self._maybeStartPollingVolume();
        }
    });
    this.on('removeListener', function (eventName) {
        if (eventName === 'inputVolume') {
            self._maybeStopPollingVolume();
        }
    });
    this.once('newListener', function () {
        // NOTE (rrowland): Ideally we would only check isEnumerationSupported here, but
        //   in at least one browser version (Tested in FF48) enumerateDevices actually
        //   returns bad data for the listed devices. Instead, we check for
        //   isOutputSelectionSupported to avoid these quirks that may negatively affect customers.
        if (!isOutputSelectionSupported) {
            _this.log.deprecated('Warning: This browser does not support audio output selection.');
        }
        if (!isVolumeSupported) {
            _this.log.deprecated('Warning: This browser does not support Twilio\'s volume indicator feature.');
        }
    });
    if (isEnumerationSupported) {
        initializeEnumeration(this);
    }
}
function initializeEnumeration(audio) {
    audio._mediaDevices.addEventListener('devicechange', audio._updateAvailableDevices);
    audio._mediaDevices.addEventListener('deviceinfochange', audio._updateAvailableDevices);
    updateAvailableDevices(audio).then(function () {
        if (!audio.isOutputSelectionSupported) {
            return;
        }
        Promise.all([
            audio.speakerDevices.set('default'),
            audio.ringtoneDevices.set('default')
        ]).catch(function (reason) {
            audio.log.warn("Warning: Unable to set audio output devices. " + reason);
        });
    });
}
inherits(AudioHelper, EventEmitter);
AudioHelper.prototype._maybeStartPollingVolume = function _maybeStartPollingVolume() {
    if (!this.isVolumeSupported || !this._inputStream) {
        return;
    }
    updateVolumeSource(this);
    if (this._isPollingInputVolume) {
        return;
    }
    var bufferLength = this._inputVolumeAnalyser.frequencyBinCount;
    var buffer = new Uint8Array(bufferLength);
    var self = this;
    this._isPollingInputVolume = true;
    requestAnimationFrame(function emitVolume() {
        if (!self._isPollingInputVolume) {
            return;
        }
        self._inputVolumeAnalyser.getByteFrequencyData(buffer);
        var inputVolume = util.average(buffer);
        self.emit('inputVolume', inputVolume / 255);
        requestAnimationFrame(emitVolume);
    });
};
AudioHelper.prototype._maybeStopPollingVolume = function _maybeStopPollingVolume() {
    if (!this.isVolumeSupported) {
        return;
    }
    if (!this._isPollingInputVolume || (this._inputStream && this.listenerCount('inputVolume'))) {
        return;
    }
    if (this._inputVolumeSource) {
        this._inputVolumeSource.disconnect();
        this._inputVolumeSource = null;
    }
    this._isPollingInputVolume = false;
};
/**
 * Replace the current input device with a new device by ID.
 * @param {string} deviceId - An ID of a device to replace the existing
 *   input device with.
 * @returns {Promise} - Rejects if the ID is not found, setting the input device
 *   fails, or an ID is not passed.
 */
AudioHelper.prototype.setInputDevice = function setInputDevice(deviceId) {
    if (util.isFirefox()) {
        return Promise.reject(new Error('Firefox does not currently support opening multiple ' +
            'audio input tracks simultaneously, even across different tabs. As a result, ' +
            'Device.audio.setInputDevice is disabled on Firefox until support is added.\n' +
            'Related BugZilla thread: https://bugzilla.mozilla.org/show_bug.cgi?id=1299324'));
    }
    return this._setInputDevice(deviceId, false);
};
/**
 * Replace the current input device with a new device by ID.
 * @private
 * @param {string} deviceId - An ID of a device to replace the existing
 *   input device with.
 * @param {boolean} forceGetUserMedia - If true, getUserMedia will be called even if
 *   the specified device is already active.
 * @returns {Promise} - Rejects if the ID is not found, setting the input device
 *   fails, or an ID is not passed.
 */
AudioHelper.prototype._setInputDevice = function _setInputDevice(deviceId, forceGetUserMedia) {
    if (typeof deviceId !== 'string') {
        return Promise.reject(new Error('Must specify the device to set'));
    }
    var device = this.availableInputDevices.get(deviceId);
    if (!device) {
        return Promise.reject(new Error("Device not found: " + deviceId));
    }
    if (this._inputDevice && this._inputDevice.deviceId === deviceId && this._inputStream) {
        if (!forceGetUserMedia) {
            return Promise.resolve();
        }
        // If the currently active track is still in readyState `live`, gUM may return the same track
        // rather than returning a fresh track.
        this._inputStream.getTracks().forEach(function (track) {
            track.stop();
        });
    }
    var self = this;
    return this._getUserMedia({
        audio: { deviceId: { exact: deviceId } }
    }).then(function onGetUserMediaSuccess(stream) {
        return self._onActiveInputChanged(stream).then(function () {
            replaceStream(self, stream);
            self._inputDevice = device;
            self._maybeStartPollingVolume();
        });
    });
};
/**
 * Unset the input device, stopping the tracks. This should only be called when not in a connection, and
 *   will not allow removal of the input device during a live call.
 * @returns {Promise} Rejects if the input device is currently in use by a connection.
 */
AudioHelper.prototype.unsetInputDevice = function unsetInputDevice() {
    if (!this.inputDevice) {
        return Promise.resolve();
    }
    var self = this;
    return this._onActiveInputChanged(null).then(function () {
        replaceStream(self, null);
        self._inputDevice = null;
        self._maybeStopPollingVolume();
    });
};
/**
 * Unbind the listeners from mediaDevices.
 * @private
 */
AudioHelper.prototype._unbind = function _unbind() {
    this._mediaDevices.removeEventListener('devicechange', this._updateAvailableDevices);
    this._mediaDevices.removeEventListener('deviceinfochange', this._updateAvailableDevices);
};
/**
 * @event AudioHelper#deviceChange
 * Fired when the list of available devices has changed.
 * @param {Array<MediaDeviceInfo>} lostActiveDevices - An array of all currently-active
 *   devices that were removed with this device change. An empty array if the current
 *   active devices remain unchanged. A non-empty array is an indicator that the user
 *   experience has likely been impacted.
 */
/**
 * Merge the passed Options into AudioHelper. Currently used to merge the deprecated
 *   <Options>Device.sounds object onto the new AudioHelper interface. Mutates
 *   by reference, sharing state between Device and AudioHelper.
 * @param {AudioHelper} audioHelper - The AudioHelper instance to merge the Options
 *   onto.
 * @param {EnabledSounds} enabledSounds - The initial sound settings to merge.
 * @private
 */
function addOptionsToAudioHelper(audioHelper, enabledSounds) {
    function setValue(key, value) {
        if (typeof value !== 'undefined') {
            enabledSounds[key] = value;
        }
        return enabledSounds[key];
    }
    Object.keys(enabledSounds).forEach(function (key) {
        audioHelper[key] = setValue.bind(null, key);
    });
}
/**
 * Update the available input and output devices
 * @param {AudioHelper} audio
 * @returns {Promise}
 * @private
 */
function updateAvailableDevices(audio) {
    return audio._mediaDevices.enumerateDevices().then(function (devices) {
        updateDevices(audio, filterByKind(devices, 'audiooutput'), audio.availableOutputDevices, removeLostOutput);
        updateDevices(audio, filterByKind(devices, 'audioinput'), audio.availableInputDevices, removeLostInput);
        var defaultDevice = audio.availableOutputDevices.get('default')
            || Array.from(audio.availableOutputDevices.values())[0];
        [audio.speakerDevices, audio.ringtoneDevices].forEach(function (outputDevices) {
            if (!outputDevices.get().size && audio.availableOutputDevices.size) {
                outputDevices.set(defaultDevice.deviceId);
            }
        });
    });
}
/**
 * Remove an input device from outputs
 * @param {AudioHelper} audio
 * @param {MediaDeviceInfoShim} lostDevice
 * @returns {boolean} wasActive
 * @private
 */
function removeLostOutput(audio, lostDevice) {
    return audio.speakerDevices._delete(lostDevice) |
        audio.ringtoneDevices._delete(lostDevice);
}
/**
 * Remove an input device from inputs
 * @param {AudioHelper} audio
 * @param {MediaDeviceInfoShim} lostDevice
 * @returns {boolean} wasActive
 * @private
 */
function removeLostInput(audio, lostDevice) {
    if (!audio.inputDevice || audio.inputDevice.deviceId !== lostDevice.deviceId) {
        return false;
    }
    replaceStream(audio, null);
    audio._inputDevice = null;
    audio._maybeStopPollingVolume();
    var defaultDevice = audio.availableInputDevices.get('default')
        || Array.from(audio.availableInputDevices.values())[0];
    if (defaultDevice) {
        audio.setInputDevice(defaultDevice.deviceId);
    }
    return true;
}
function filterByKind(devices, kind) {
    return devices.filter(function (device) { return device.kind === kind; });
}
function getDeviceId(device) {
    return device.deviceId;
}
function updateDevices(audio, updatedDevices, availableDevices, removeLostDevice) {
    var updatedDeviceIds = updatedDevices.map(getDeviceId);
    var knownDeviceIds = Array.from(availableDevices.values()).map(getDeviceId);
    var lostActiveDevices = [];
    // Remove lost devices
    var lostDeviceIds = util.difference(knownDeviceIds, updatedDeviceIds);
    lostDeviceIds.forEach(function (lostDeviceId) {
        var lostDevice = availableDevices.get(lostDeviceId);
        availableDevices.delete(lostDeviceId);
        if (removeLostDevice(audio, lostDevice)) {
            lostActiveDevices.push(lostDevice);
        }
    });
    // Add any new devices, or devices with updated labels
    var deviceChanged = false;
    updatedDevices.forEach(function (newDevice) {
        var existingDevice = availableDevices.get(newDevice.deviceId);
        var newMediaDeviceInfo = wrapMediaDeviceInfo(audio, newDevice);
        if (!existingDevice || existingDevice.label !== newMediaDeviceInfo.label) {
            availableDevices.set(newDevice.deviceId, newMediaDeviceInfo);
            deviceChanged = true;
        }
    });
    if (deviceChanged || lostDeviceIds.length) {
        // Force a new gUM in case the underlying tracks of the active stream have changed. One
        //   reason this might happen is when `default` is selected and set to a USB device,
        //   then that device is unplugged or plugged back in. We can't check for the 'ended'
        //   event or readyState because it is asynchronous and may take upwards of 5 seconds,
        //   in my testing. (rrowland)
        if (audio.inputDevice !== null && audio.inputDevice.deviceId === 'default') {
            audio.log.warn(['Calling getUserMedia after device change to ensure that the',
                'tracks of the active device (default) have not gone stale.'].join(' '));
            audio._setInputDevice(audio._inputDevice.deviceId, true);
        }
        audio.emit('deviceChange', lostActiveDevices);
    }
}
var kindAliases = {
    audiooutput: 'Audio Output',
    audioinput: 'Audio Input'
};
function getUnknownDeviceIndex(audioHelper, mediaDeviceInfo) {
    var id = mediaDeviceInfo.deviceId;
    var kind = mediaDeviceInfo.kind;
    var unknownIndexes = audioHelper._unknownDeviceIndexes;
    if (!unknownIndexes[kind]) {
        unknownIndexes[kind] = {};
    }
    var index = unknownIndexes[kind][id];
    if (!index) {
        index = Object.keys(unknownIndexes[kind]).length + 1;
        unknownIndexes[kind][id] = index;
    }
    return index;
}
function wrapMediaDeviceInfo(audioHelper, mediaDeviceInfo) {
    var options = {
        deviceId: mediaDeviceInfo.deviceId,
        groupId: mediaDeviceInfo.groupId,
        kind: mediaDeviceInfo.kind,
        label: mediaDeviceInfo.label
    };
    if (!options.label) {
        if (options.deviceId === 'default') {
            options.label = 'Default';
        }
        else {
            var index = getUnknownDeviceIndex(audioHelper, mediaDeviceInfo);
            options.label = "Unknown " + kindAliases[options.kind] + " Device " + index;
        }
    }
    return new MediaDeviceInfoShim(options);
}
function updateVolumeSource(audioHelper) {
    if (audioHelper._inputVolumeSource) {
        audioHelper._inputVolumeSource.disconnect();
        audioHelper._inputVolumeSource = null;
    }
    audioHelper._inputVolumeSource = audioHelper._audioContext.createMediaStreamSource(audioHelper._inputStream);
    audioHelper._inputVolumeSource.connect(audioHelper._inputVolumeAnalyser);
}
function replaceStream(audio, stream) {
    if (audio._inputStream) {
        audio._inputStream.getTracks().forEach(function (track) {
            track.stop();
        });
    }
    audio._inputStream = stream;
}
module.exports = AudioHelper;

},{"./log":9,"./outputdevicecollection":10,"./shims/mediadeviceinfo":23,"./shims/mediadevices":24,"./util":27,"events":40,"util":51}],5:[function(require,module,exports){
"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
var events_1 = require("events");
var device_1 = require("./device");
var tslog_1 = require("./tslog");
var C = require('./constants');
var Exception = require('./util').Exception;
var PeerConnection = require('./rtc').PeerConnection;
var RTCMonitor = require('./rtc/monitor');
var util = require('util');
exports.DTMF_INTER_TONE_GAP = 70;
exports.DTMF_PAUSE_DURATION = 500;
exports.DTMF_TONE_DURATION = 160;
exports.METRICS_BATCH_SIZE = 10;
exports.METRICS_DELAY = 20000;
var WARNING_NAMES = {
    audioInputLevel: 'audio-input-level',
    audioOutputLevel: 'audio-output-level',
    jitter: 'jitter',
    mos: 'mos',
    packetsLostFraction: 'packet-loss',
    rtt: 'rtt',
};
var WARNING_PREFIXES = {
    max: 'high-',
    maxDuration: 'constant-',
    min: 'low-',
};
var hasBeenWarnedHandlers = false;
/**
 * Possible states of the {@link Connection}.
 */
var ConnectionState;
(function (ConnectionState) {
    ConnectionState["Closed"] = "closed";
    ConnectionState["Connecting"] = "connecting";
    ConnectionState["Open"] = "open";
    ConnectionState["Pending"] = "pending";
    ConnectionState["Ringing"] = "ringing";
})(ConnectionState = exports.ConnectionState || (exports.ConnectionState = {}));
/**
 * Different issues that may have been experienced during a call, that can be
 * reported to Twilio Insights via {@link Connection}.postFeedback().
 */
var FeedbackIssue;
(function (FeedbackIssue) {
    FeedbackIssue["AudioLatency"] = "audio-latency";
    FeedbackIssue["ChoppyAudio"] = "choppy-audio";
    FeedbackIssue["DroppedCall"] = "dropped-call";
    FeedbackIssue["Echo"] = "echo";
    FeedbackIssue["NoisyCall"] = "noisy-call";
    FeedbackIssue["OneWayAudio"] = "one-way-audio";
})(FeedbackIssue = exports.FeedbackIssue || (exports.FeedbackIssue = {}));
/**
 * A rating of call quality experienced during a call, to be reported to Twilio Insights
 * via {@link Connection}.postFeedback().
 */
var FeedbackScore;
(function (FeedbackScore) {
    FeedbackScore[FeedbackScore["One"] = 1] = "One";
    FeedbackScore[FeedbackScore["Two"] = 2] = "Two";
    FeedbackScore[FeedbackScore["Three"] = 3] = "Three";
    FeedbackScore[FeedbackScore["Four"] = 4] = "Four";
    FeedbackScore[FeedbackScore["Five"] = 5] = "Five";
})(FeedbackScore = exports.FeedbackScore || (exports.FeedbackScore = {}));
/**
 * The directionality of the {@link Connection}, whether incoming or outgoing.
 */
var CallDirection;
(function (CallDirection) {
    CallDirection["Incoming"] = "INCOMING";
    CallDirection["Outgoing"] = "OUTGOING";
})(CallDirection = exports.CallDirection || (exports.CallDirection = {}));
/**
 * A {@link Connection} represents a media and signaling connection to a TwiML application.
 */
var Connection = /** @class */ (function (_super) {
    __extends(Connection, _super);
    /**
     * @constructor
     * @param config - Mandatory configuration options
     * @param [options] - Optional settings
     */
    function Connection(config, options) {
        var _this = _super.call(this) || this;
        /**
         * Call parameters received from Twilio for an incoming call.
         */
        _this.parameters = {};
        /**
         * The most recent input volume value.
         */
        _this._latestInputVolume = 0;
        /**
         * The most recent output volume value.
         */
        _this._latestOutputVolume = 0;
        /**
         * Whether the call has been answered.
         */
        _this._isAnswered = false;
        /**
         * An instance of Log to use.
         */
        _this._log = new tslog_1.default(tslog_1.LogLevel.Off);
        /**
         * A batch of metrics samples to send to Insights. Gets cleared after
         * each send and appended to on each new sample.
         */
        _this._metricsSamples = [];
        /**
         * A Map of Sounds to play.
         */
        _this._soundcache = new Map();
        /**
         * State of the {@link Connection}.
         */
        _this._status = ConnectionState.Pending;
        /**
         * Options passed to this {@link Connection}.
         */
        _this.options = {
            debug: false,
            enableRingingState: false,
            mediaStreamFactory: PeerConnection,
            offerSdp: null,
            shouldPlayDisconnect: true,
        };
        /**
         * Whether the {@link Connection} should send a hangup on disconnect.
         */
        _this.sendHangup = true;
        /**
         * String representation of {@link Connection} instance.
         */
        _this.toString = function () { return '[Twilio.Connection instance]'; };
        /**
         * Called when the {@link Connection} is answered.
         * @param payload
         */
        _this._onAnswer = function (payload) {
            // answerOnBridge=false will send a 183 which we need to catch in _onRinging when
            // the enableRingingState flag is disabled. In that case, we will receive a 200 after
            // the callee accepts the call firing a second `accept` event if we don't
            // short circuit here.
            if (_this._isAnswered) {
                return;
            }
            _this._setCallSid(payload);
            _this._isAnswered = true;
            _this._maybeTransitionToOpen();
        };
        /**
         * Called when the {@link Connection} is cancelled.
         * @param payload
         */
        _this._onCancel = function (payload) {
            // (rrowland) Is this check necessary? Verify, and if so move to pstream / VSP module.
            var callsid = payload.callsid;
            if (_this.parameters.CallSid === callsid) {
                _this._status = ConnectionState.Closed;
                _this.emit('cancel');
                _this.pstream.removeListener('cancel', _this._onCancel);
            }
        };
        /**
         * Called when the {@link Connection} is hung up.
         * @param payload
         */
        _this._onHangup = function (payload) {
            /**
             *  see if callsid passed in message matches either callsid or outbound id
             *  connection should always have either callsid or outbound id
             *  if no callsid passed hangup anyways
             */
            if (payload.callsid && (_this.parameters.CallSid || _this.outboundConnectionId)) {
                if (payload.callsid !== _this.parameters.CallSid
                    && payload.callsid !== _this.outboundConnectionId) {
                    return;
                }
            }
            else if (payload.callsid) {
                // hangup is for another connection
                return;
            }
            _this._log.info('Received HANGUP from gateway');
            if (payload.error) {
                var error = {
                    code: payload.error.code || 31000,
                    connection: _this,
                    message: payload.error.message || 'Error sent from gateway in HANGUP',
                };
                _this._log.error('Received an error from the gateway:', error);
                _this.emit('error', error);
            }
            _this.sendHangup = false;
            _this._publisher.info('connection', 'disconnected-by-remote', null, _this);
            _this._disconnect(null, true);
            _this._cleanupEventListeners();
        };
        /**
         * When we get a RINGING signal from PStream, update the {@link Connection} status.
         * @param payload
         */
        _this._onRinging = function (payload) {
            _this._setCallSid(payload);
            // If we're not in 'connecting' or 'ringing' state, this event was received out of order.
            if (_this._status !== ConnectionState.Connecting && _this._status !== ConnectionState.Ringing) {
                return;
            }
            var hasEarlyMedia = !!payload.sdp;
            if (_this.options.enableRingingState) {
                _this._status = ConnectionState.Ringing;
                _this._publisher.info('connection', 'outgoing-ringing', { hasEarlyMedia: hasEarlyMedia }, _this);
                _this.emit('ringing', hasEarlyMedia);
                // answerOnBridge=false will send a 183, which we need to interpret as `answer` when
                // the enableRingingState flag is disabled in order to maintain a non-breaking API from 1.4.24
            }
            else if (hasEarlyMedia) {
                _this._onAnswer(payload);
            }
        };
        /**
         * Called each time RTCMonitor emits a sample. Batches the metrics samples and sends them
         * to Insights.
         * @param sample
         */
        _this._onRTCSample = function (sample) {
            sample.inputVolume = _this._latestInputVolume;
            sample.outputVolume = _this._latestOutputVolume;
            _this._metricsSamples.push(sample);
            if (_this._metricsSamples.length >= exports.METRICS_BATCH_SIZE) {
                _this._publishMetrics();
            }
        };
        /**
         * Re-emit an RTCMonitor warning as a {@link Connection}.warning or .warning-cleared event.
         * @param warningData
         * @param wasCleared - Whether this is a -cleared or -raised event.
         */
        _this._reemitWarning = function (warningData, wasCleared) {
            var groupPrefix = /^audio/.test(warningData.name) ?
                'audio-level-' : 'network-quality-';
            var groupSuffix = wasCleared ? '-cleared' : '-raised';
            var groupName = groupPrefix + "warning" + groupSuffix;
            var warningPrefix = WARNING_PREFIXES[warningData.threshold.name];
            var warningName = warningPrefix + WARNING_NAMES[warningData.name];
            // Ignore constant input if the Connection is muted (Expected)
            if (warningName === 'constant-audio-input-level' && _this.isMuted()) {
                return;
            }
            var level = wasCleared ? 'info' : 'warning';
            // Avoid throwing false positives as warnings until we refactor volume metrics
            if (warningName === 'constant-audio-output-level') {
                level = 'info';
            }
            var payloadData = { threshold: warningData.threshold.value };
            if (warningData.values) {
                payloadData.values = warningData.values.map(function (value) {
                    if (typeof value === 'number') {
                        return Math.round(value * 100) / 100;
                    }
                    return value;
                });
            }
            else if (warningData.value) {
                payloadData.value = warningData.value;
            }
            _this._publisher.post(level, groupName, warningName, { data: payloadData }, _this);
            if (warningName !== 'constant-audio-output-level') {
                var emitName = wasCleared ? 'warning-cleared' : 'warning';
                _this.emit(emitName, warningName);
            }
        };
        /**
         * Re-emit an RTCMonitor warning-cleared as a .warning-cleared event.
         * @param warningData
         */
        _this._reemitWarningCleared = function (warningData) {
            _this._reemitWarning(warningData, true);
        };
        _this._soundcache = config.soundcache;
        _this.message = options && options.twimlParams || {};
        _this.customParameters = new Map(Object.entries(_this.message).map(function (_a) {
            var key = _a[0], val = _a[1];
            return [key, val ? val.toString() : ''];
        }));
        Object.assign(_this.options, options);
        if (_this.options.callParameters) {
            _this.parameters = _this.options.callParameters;
        }
        _this._direction = _this.parameters.CallSid ? CallDirection.Incoming : CallDirection.Outgoing;
        _this._log.setLogLevel(_this.options.debug ? tslog_1.LogLevel.Debug
            : _this.options.warnings ? tslog_1.LogLevel.Warn
                : tslog_1.LogLevel.Off);
        var publisher = _this._publisher = config.publisher;
        if (_this._direction === CallDirection.Incoming) {
            publisher.info('connection', 'incoming', null, _this);
        }
        var monitor = _this._monitor = new (_this.options.RTCMonitor || RTCMonitor)();
        monitor.on('sample', _this._onRTCSample);
        // First 20 seconds or so are choppy, so let's not bother with these warnings.
        monitor.disableWarnings();
        setTimeout(function () { return monitor.enableWarnings(); }, exports.METRICS_DELAY);
        monitor.on('warning', _this._reemitWarning);
        monitor.on('warning-cleared', _this._reemitWarningCleared);
        _this.mediaStream = new (_this.options.MediaStream || _this.options.mediaStreamFactory)(config.audioHelper, config.pstream, config.getUserMedia, {
            debug: _this.options.debug,
            warnings: _this.options.warnings,
        });
        _this.on('volume', function (inputVolume, outputVolume) {
            _this._latestInputVolume = inputVolume;
            _this._latestOutputVolume = outputVolume;
        });
        _this.mediaStream.onvolume = _this.emit.bind(_this, 'volume');
        _this.mediaStream.oniceconnectionstatechange = function (state) {
            var level = state === 'failed' ? 'error' : 'debug';
            _this._publisher.post(level, 'ice-connection-state', state, null, _this);
        };
        _this.mediaStream.onicegatheringstatechange = function (state) {
            _this._publisher.debug('signaling-state', state, null, _this);
        };
        _this.mediaStream.onsignalingstatechange = function (state) {
            _this._publisher.debug('signaling-state', state, null, _this);
        };
        _this.mediaStream.ondisconnect = function (msg) {
            _this._log.info(msg);
            _this._publisher.warn('network-quality-warning-raised', 'ice-connectivity-lost', {
                message: msg,
            }, _this);
            _this.emit('warning', 'ice-connectivity-lost');
        };
        _this.mediaStream.onreconnect = function (msg) {
            _this._log.info(msg);
            _this._publisher.info('network-quality-warning-cleared', 'ice-connectivity-lost', {
                message: msg,
            }, _this);
            _this.emit('warning-cleared', 'ice-connectivity-lost');
        };
        _this.mediaStream.onerror = function (e) {
            if (e.disconnect === true) {
                _this._disconnect(e.info && e.info.message);
            }
            var error = {
                code: e.info.code,
                connection: _this,
                info: e.info,
                message: e.info.message || 'Error with mediastream',
            };
            _this._log.error('Received an error from MediaStream:', e);
            _this.emit('error', error);
        };
        _this.mediaStream.onopen = function () {
            // NOTE(mroberts): While this may have been happening in previous
            // versions of Chrome, since Chrome 45 we have seen the
            // PeerConnection's onsignalingstatechange handler invoked multiple
            // times in the same signalingState 'stable'. When this happens, we
            // invoke this onopen function. If we invoke it twice without checking
            // for _status 'open', we'd accidentally close the PeerConnection.
            //
            // See <https://code.google.com/p/webrtc/issues/detail?id=4996>.
            if (_this._status === ConnectionState.Open) {
                return;
            }
            else if (_this._status === ConnectionState.Ringing || _this._status === ConnectionState.Connecting) {
                _this.mute(false);
                _this._maybeTransitionToOpen();
            }
            else {
                // call was probably canceled sometime before this
                _this.mediaStream.close();
            }
        };
        _this.mediaStream.onclose = function () {
            _this._status = ConnectionState.Closed;
            if (_this.options.shouldPlayDisconnect) {
                _this._soundcache.get(device_1.SoundName.Disconnect).play();
            }
            monitor.disable();
            _this._publishMetrics();
            _this.emit('disconnect', _this);
        };
        // temporary call sid to be used for outgoing calls
        _this.outboundConnectionId = generateTempCallSid();
        _this.pstream = config.pstream;
        _this.pstream.on('cancel', _this._onCancel);
        _this.pstream.on('ringing', _this._onRinging);
        _this.on('error', function (error) {
            _this._publisher.error('connection', 'error', {
                code: error.code, message: error.message,
            }, _this);
            if (_this.pstream && _this.pstream.status === 'disconnected') {
                _this._cleanupEventListeners();
            }
        });
        _this.on('disconnect', function () {
            _this._cleanupEventListeners();
        });
        return _this;
    }
    Object.defineProperty(Connection.prototype, "direction", {
        /**
         * Whether this {@link Connection} is incoming or outgoing.
         */
        get: function () {
            return this._direction;
        },
        enumerable: true,
        configurable: true
    });
    /**
     * Get the real CallSid. Returns null if not present or is a temporary call sid.
     * @deprecated
     */
    Connection.prototype._getRealCallSid = function () {
        this._log.warn('_getRealCallSid is deprecated and will be removed in 2.0.');
        return /^TJ/.test(this.parameters.CallSid) ? null : this.parameters.CallSid;
    };
    /**
     * Get the temporary CallSid.
     * @deprecated
     */
    Connection.prototype._getTempCallSid = function () {
        this._log.warn('_getTempCallSid is deprecated and will be removed in 2.0. \
                    Please use outboundConnectionId instead.');
        return this.outboundConnectionId;
    };
    Connection.prototype.accept = function (handlerOrConstraints) {
        var _this = this;
        if (typeof handlerOrConstraints === 'function') {
            this._addHandler('accept', handlerOrConstraints);
            return;
        }
        if (this._status !== ConnectionState.Pending) {
            return;
        }
        var audioConstraints = handlerOrConstraints || this.options.audioConstraints;
        this._status = ConnectionState.Connecting;
        var connect = function () {
            if (_this._status !== ConnectionState.Connecting) {
                // call must have been canceled
                _this._cleanupEventListeners();
                _this.mediaStream.close();
                return;
            }
            var onLocalAnswer = function (pc) {
                _this._publisher.info('connection', 'accepted-by-local', null, _this);
                _this._monitor.enable(pc);
            };
            var onRemoteAnswer = function (pc) {
                _this._publisher.info('connection', 'accepted-by-remote', null, _this);
                _this._monitor.enable(pc);
            };
            var sinkIds = typeof _this.options.getSinkIds === 'function' && _this.options.getSinkIds();
            if (Array.isArray(sinkIds)) {
                _this.mediaStream._setSinkIds(sinkIds).catch(function () {
                    // (rrowland) We don't want this to throw to console since the customer
                    // can't control this. This will most commonly be rejected on browsers
                    // that don't support setting sink IDs.
                });
            }
            _this.pstream.addListener('hangup', _this._onHangup);
            if (_this._direction === CallDirection.Incoming) {
                _this._isAnswered = true;
                _this.mediaStream.answerIncomingCall(_this.parameters.CallSid, _this.options.offerSdp, _this.options.rtcConstraints, _this.options.iceServers, onLocalAnswer);
            }
            else {
                var params = Array.from(_this.customParameters.entries()).map(function (pair) {
                    return encodeURIComponent(pair[0]) + "=" + encodeURIComponent(pair[1]);
                }).join('&');
                _this.pstream.once('answer', _this._onAnswer.bind(_this));
                _this.mediaStream.makeOutgoingCall(_this.pstream.token, params, _this.outboundConnectionId, _this.options.rtcConstraints, _this.options.iceServers, onRemoteAnswer);
            }
        };
        if (this.options.beforeAccept) {
            this.options.beforeAccept(this);
        }
        var inputStream = typeof this.options.getInputStream === 'function' && this.options.getInputStream();
        var promise = inputStream
            ? this.mediaStream.setInputTracksFromStream(inputStream)
            : this.mediaStream.openWithConstraints(audioConstraints);
        promise.then(function () {
            _this._publisher.info('get-user-media', 'succeeded', {
                data: { audioConstraints: audioConstraints },
            }, _this);
            connect();
        }, function (error) {
            var message;
            var code;
            if (error.code && error.code === 31208
                || error.name && error.name === 'PermissionDeniedError') {
                code = 31208;
                message = 'User denied access to microphone, or the web browser did not allow microphone '
                    + 'access at this address.';
                _this._publisher.error('get-user-media', 'denied', {
                    data: {
                        audioConstraints: audioConstraints,
                        error: error,
                    },
                }, _this);
            }
            else {
                code = 31201;
                message = "Error occurred while accessing microphone: " + error.name + (error.message
                    ? " (" + error.message + ")"
                    : '');
                _this._publisher.error('get-user-media', 'failed', {
                    data: {
                        audioConstraints: audioConstraints,
                        error: error,
                    },
                }, _this);
            }
            _this._disconnect();
            _this.emit('error', { message: message, code: code });
        });
    };
    Connection.prototype.cancel = function (handler) {
        this._log.warn('.cancel() is deprecated. Please use .ignore() instead.');
        if (handler) {
            this.ignore(handler);
        }
        else {
            this.ignore();
        }
    };
    Connection.prototype.disconnect = function (handler) {
        if (typeof handler === 'function') {
            this._addHandler('disconnect', handler);
            return;
        }
        this._disconnect();
    };
    /**
     * @deprecated - Set a handler for the error event.
     */
    Connection.prototype.error = function (handler) {
        if (typeof handler === 'function') {
            this._addHandler('error', handler);
        }
    };
    /**
     * Get the local MediaStream, if set.
     */
    Connection.prototype.getLocalStream = function () {
        return this.mediaStream && this.mediaStream.stream;
    };
    /**
     * Get the remote MediaStream, if set.
     */
    Connection.prototype.getRemoteStream = function () {
        return this.mediaStream && this.mediaStream._remoteStream;
    };
    Connection.prototype.ignore = function (handler) {
        if (typeof handler === 'function') {
            this._addHandler('cancel', handler);
            return;
        }
        if (this._status !== ConnectionState.Pending) {
            return;
        }
        this._status = ConnectionState.Closed;
        this.emit('cancel');
        this.mediaStream.ignore(this.parameters.CallSid);
        this._publisher.info('connection', 'ignored-by-local', null, this);
    };
    /**
     * Check if connection is muted
     */
    Connection.prototype.isMuted = function () {
        return this.mediaStream.isMuted;
    };
    Connection.prototype.mute = function (shouldMute) {
        if (shouldMute === void 0) { shouldMute = true; }
        if (typeof shouldMute === 'function') {
            this._addHandler('mute', shouldMute);
            return;
        }
        var wasMuted = this.mediaStream.isMuted;
        this.mediaStream.mute(shouldMute);
        var isMuted = this.mediaStream.isMuted;
        if (wasMuted !== isMuted) {
            this._publisher.info('connection', isMuted ? 'muted' : 'unmuted', null, this);
            this.emit('mute', isMuted, this);
        }
    };
    Connection.prototype.reject = function (handler) {
        if (typeof handler === 'function') {
            this._addHandler('reject', handler);
            return;
        }
        if (this._status !== ConnectionState.Pending) {
            return;
        }
        var payload = { callsid: this.parameters.CallSid };
        this.pstream.publish('reject', payload);
        this.emit('reject');
        this.mediaStream.reject(this.parameters.CallSid);
        this._publisher.info('connection', 'rejected-by-local', null, this);
    };
    /**
     * Post an event to Endpoint Analytics indicating that the end user
     *   has given call quality feedback. Called without a score, this
     *   will report that the customer declined to give feedback.
     * @param score - The end-user's rating of the call; an
     *   integer 1 through 5. Or undefined if the user declined to give
     *   feedback.
     * @param issue - The primary issue the end user
     *   experienced on the call. Can be: ['one-way-audio', 'choppy-audio',
     *   'dropped-call', 'audio-latency', 'noisy-call', 'echo']
     */
    Connection.prototype.postFeedback = function (score, issue) {
        if (typeof score === 'undefined' || score === null) {
            return this._postFeedbackDeclined();
        }
        if (!Object.values(FeedbackScore).includes(score)) {
            throw new Error("Feedback score must be one of: " + Object.values(FeedbackScore));
        }
        if (typeof issue !== 'undefined' && issue !== null && !Object.values(FeedbackIssue).includes(issue)) {
            throw new Error("Feedback issue must be one of: " + Object.values(FeedbackIssue));
        }
        return this._publisher.info('feedback', 'received', {
            issue_name: issue,
            quality_score: score,
        }, this, true);
    };
    /**
     * Send a string of digits.
     * @param digits
     */
    Connection.prototype.sendDigits = function (digits) {
        if (digits.match(/[^0-9*#w]/)) {
            throw new Exception('Illegal character passed into sendDigits');
        }
        var sequence = [];
        digits.split('').forEach(function (digit) {
            var dtmf = (digit !== 'w') ? "dtmf" + digit : '';
            if (dtmf === 'dtmf*') {
                dtmf = 'dtmfs';
            }
            if (dtmf === 'dtmf#') {
                dtmf = 'dtmfh';
            }
            sequence.push(dtmf);
        });
        // Binds soundCache to be used in recursion until all digits have been played.
        (function playNextDigit(soundCache) {
            var digit = sequence.shift();
            if (digit) {
                soundCache.get(digit).play();
            }
            if (sequence.length) {
                setTimeout(playNextDigit.bind(null, soundCache), 200);
            }
        })(this._soundcache);
        var dtmfSender = this.mediaStream.getOrCreateDTMFSender();
        function insertDTMF(dtmfs) {
            if (!dtmfs.length) {
                return;
            }
            var dtmf = dtmfs.shift();
            if (dtmf && dtmf.length) {
                dtmfSender.insertDTMF(dtmf, exports.DTMF_TONE_DURATION, exports.DTMF_INTER_TONE_GAP);
            }
            setTimeout(insertDTMF.bind(null, dtmfs), exports.DTMF_PAUSE_DURATION);
        }
        if (dtmfSender) {
            if (!('canInsertDTMF' in dtmfSender) || dtmfSender.canInsertDTMF) {
                this._log.info('Sending digits using RTCDTMFSender');
                // NOTE(mroberts): We can't just map 'w' to ',' since
                // RTCDTMFSender's pause duration is 2 s and Twilio's is more
                // like 500 ms. Instead, we will fudge it with setTimeout.
                insertDTMF(digits.split('w'));
                return;
            }
            this._log.info('RTCDTMFSender cannot insert DTMF');
        }
        // send pstream message to send DTMF
        this._log.info('Sending digits over PStream');
        if (this.pstream !== null && this.pstream.status !== 'disconnected') {
            this.pstream.publish('dtmf', {
                callsid: this.parameters.CallSid,
                dtmf: digits,
            });
        }
        else {
            var error = {
                code: 31000,
                connection: this,
                message: 'Could not send DTMF: Signaling channel is disconnected',
            };
            this.emit('error', error);
        }
    };
    /**
     * Get the current {@link Connection} status.
     */
    Connection.prototype.status = function () {
        return this._status;
    };
    /**
     * @deprecated - Unmute the {@link Connection}.
     */
    Connection.prototype.unmute = function () {
        this._log.warn('.unmute() is deprecated. Please use .mute(false) to unmute a call instead.');
        this.mute(false);
    };
    /**
     * Fired on `requestAnimationFrame` (up to 60fps, depending on browser) with
     *   the current input and output volumes, as a percentage of maximum
     *   volume, between -100dB and -30dB. Represented by a floating point
     *   number between 0.0 and 1.0, inclusive.
     * @param handler
     */
    Connection.prototype.volume = function (handler) {
        if (!window || (!window.AudioContext && !window.webkitAudioContext)) {
            this._log.warn('This browser does not support Connection.volume');
        }
        this._addHandler('volume', handler);
    };
    /**
     * Add a handler for an EventEmitter and emit a deprecation warning on first call.
     * @param eventName - Name of the event
     * @param handler - A handler to call when the event is emitted
     */
    Connection.prototype._addHandler = function (eventName, handler) {
        if (!hasBeenWarnedHandlers) {
            this._log.warn("Connection callback handlers (accept, cancel, disconnect, error, ignore, mute, reject,\n        volume) have been deprecated and will be removed in the next breaking release. Instead, the EventEmitter         interface can be used to set event listeners. Example: connection.on('" + eventName + "', handler)");
            hasBeenWarnedHandlers = true;
        }
        this.addListener(eventName, handler);
        return this;
    };
    /**
     * Clean up event listeners.
     */
    Connection.prototype._cleanupEventListeners = function () {
        var _this = this;
        var cleanup = function () {
            if (!_this.pstream) {
                return;
            }
            _this.pstream.removeListener('answer', _this._onAnswer);
            _this.pstream.removeListener('cancel', _this._onCancel);
            _this.pstream.removeListener('hangup', _this._onHangup);
            _this.pstream.removeListener('ringing', _this._onRinging);
        };
        // This is kind of a hack, but it lets us avoid rewriting more code.
        // Basically, there's a sequencing problem with the way PeerConnection raises
        // the
        //
        //   Cannot establish connection. Client is disconnected
        //
        // error in Connection#accept. It calls PeerConnection#onerror, which emits
        // the error event on Connection. An error handler on Connection then calls
        // cleanupEventListeners, but then control returns to Connection#accept. It's
        // at this point that we add a listener for the answer event that never gets
        // removed. setTimeout will allow us to rerun cleanup again, _after_
        // Connection#accept returns.
        cleanup();
        setTimeout(cleanup, 0);
    };
    /**
     * Create the payload wrapper for a batch of metrics to be sent to Insights.
     */
    Connection.prototype._createMetricPayload = function () {
        var payload = {
            call_sid: this.parameters.CallSid,
            sdk_version: C.RELEASE_VERSION,
            selected_region: this.options.selectedRegion,
        };
        if (this.options.gateway) {
            payload.gateway = this.options.gateway;
        }
        if (this.options.region) {
            payload.region = this.options.region;
        }
        payload.direction = this._direction;
        return payload;
    };
    /**
     * Disconnect the {@link Connection}.
     * @param message - A message explaining why the {@link Connection} is being disconnected.
     * @param wasRemote - Whether the disconnect was triggered locally or remotely.
     */
    Connection.prototype._disconnect = function (message, wasRemote) {
        message = typeof message === 'string' ? message : null;
        if (this._status !== ConnectionState.Open
            && this._status !== ConnectionState.Connecting
            && this._status !== ConnectionState.Ringing) {
            return;
        }
        this._log.info('Disconnecting...');
        // send pstream hangup message
        if (this.pstream !== null && this.pstream.status !== 'disconnected' && this.sendHangup) {
            var callsid = this.parameters.CallSid || this.outboundConnectionId;
            if (callsid) {
                var payload = { callsid: callsid };
                if (message) {
                    payload.message = message;
                }
                this.pstream.publish('hangup', payload);
            }
        }
        this._cleanupEventListeners();
        this.mediaStream.close();
        if (!wasRemote) {
            this._publisher.info('connection', 'disconnected-by-local', null, this);
        }
    };
    /**
     * Transition to {@link ConnectionStatus.Open} if criteria is met.
     */
    Connection.prototype._maybeTransitionToOpen = function () {
        if (this.mediaStream && this.mediaStream.status === 'open' && this._isAnswered) {
            this._status = ConnectionState.Open;
            this.emit('accept', this);
        }
    };
    /**
     * Post an event to Endpoint Analytics indicating that the end user
     *   has ignored a request for feedback.
     */
    Connection.prototype._postFeedbackDeclined = function () {
        return this._publisher.info('feedback', 'received-none', null, this, true);
    };
    /**
     * Publish the current set of queued metrics samples to Insights.
     */
    Connection.prototype._publishMetrics = function () {
        var _this = this;
        if (this._metricsSamples.length === 0) {
            return;
        }
        this._publisher.postMetrics('quality-metrics-samples', 'metrics-sample', this._metricsSamples.splice(0), this._createMetricPayload()).catch(function (e) {
            _this._log.warn('Unable to post metrics to Insights. Received error:', e);
        });
    };
    /**
     * Set the CallSid
     * @param payload
     */
    Connection.prototype._setCallSid = function (payload) {
        var callSid = payload.callsid;
        if (!callSid) {
            return;
        }
        this.parameters.CallSid = callSid;
        this.mediaStream.callSid = callSid;
    };
    /**
     * Set the audio input tracks from a given stream.
     * @param stream
     */
    Connection.prototype._setInputTracksFromStream = function (stream) {
        return this.mediaStream.setInputTracksFromStream(stream);
    };
    /**
     * Set the audio output sink IDs.
     * @param sinkIds
     */
    Connection.prototype._setSinkIds = function (sinkIds) {
        return this.mediaStream._setSinkIds(sinkIds);
    };
    /**
     * String representation of the {@link Connection} class.
     */
    Connection.toString = function () { return '[Twilio.Connection class]'; };
    return Connection;
}(events_1.EventEmitter));
exports.default = Connection;
function generateTempCallSid() {
    return 'TJSxxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        /* tslint:disable:no-bitwise */
        var r = Math.random() * 16 | 0;
        var v = c === 'x' ? r : (r & 0x3 | 0x8);
        /* tslint:enable:no-bitwise */
        return v.toString(16);
    });
}

},{"./constants":6,"./device":7,"./rtc":15,"./rtc/monitor":17,"./tslog":26,"./util":27,"events":40,"util":51}],6:[function(require,module,exports){
var pkg = require('../../package.json');
module.exports.SOUNDS_BASE_URL = 'https://media.twiliocdn.com/sdk/js/client/sounds/releases/1.0.0';
module.exports.RELEASE_VERSION = pkg.version;

},{"../../package.json":52}],7:[function(require,module,exports){
"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
var events_1 = require("events");
var connection_1 = require("./connection");
var pstream_1 = require("./pstream");
var regions_1 = require("./regions");
var tslog_1 = require("./tslog");
var util_1 = require("./util");
var AudioHelper = require('./audiohelper');
var C = require('./constants');
var Publisher = require('./eventpublisher');
var rtc = require('./rtc');
var getUserMedia = require('./rtc/getusermedia');
var Sound = require('./sound');
exports.REGISTRATION_INTERVAL = 30000;
exports.RINGTONE_PLAY_TIMEOUT = 2000;
var hasBeenWarnedHandlers = false;
var hasBeenWarnedSounds = false;
/**
 * All valid {@link Device} event names.
 */
var DeviceEvent;
(function (DeviceEvent) {
    DeviceEvent["Cancel"] = "cancel";
    DeviceEvent["Connect"] = "connect";
    DeviceEvent["Disconnect"] = "disconnect";
    DeviceEvent["Error"] = "error";
    DeviceEvent["Incoming"] = "incoming";
    DeviceEvent["Offline"] = "offline";
    DeviceEvent["Ready"] = "ready";
})(DeviceEvent = exports.DeviceEvent || (exports.DeviceEvent = {}));
/**
 * All possible {@link Device} statuses.
 */
var DeviceStatus;
(function (DeviceStatus) {
    DeviceStatus["Busy"] = "busy";
    DeviceStatus["Offline"] = "offline";
    DeviceStatus["Ready"] = "ready";
})(DeviceStatus = exports.DeviceStatus || (exports.DeviceStatus = {}));
/**
 * Names of all sounds handled by the {@link Device}.
 */
var SoundName;
(function (SoundName) {
    SoundName["Incoming"] = "incoming";
    SoundName["Outgoing"] = "outgoing";
    SoundName["Disconnect"] = "disconnect";
    SoundName["Dtmf0"] = "dtmf0";
    SoundName["Dtmf1"] = "dtmf1";
    SoundName["Dtmf2"] = "dtmf2";
    SoundName["Dtmf3"] = "dtmf3";
    SoundName["Dtmf4"] = "dtmf4";
    SoundName["Dtmf5"] = "dtmf5";
    SoundName["Dtmf6"] = "dtmf6";
    SoundName["Dtmf7"] = "dtmf7";
    SoundName["Dtmf8"] = "dtmf8";
    SoundName["Dtmf9"] = "dtmf9";
    SoundName["DtmfS"] = "dtmfs";
    SoundName["DtmfH"] = "dtmfh";
})(SoundName = exports.SoundName || (exports.SoundName = {}));
/**
 * Twilio Device. Allows registration for incoming calls, and placing outgoing calls.
 */
var Device = /** @class */ (function (_super) {
    __extends(Device, _super);
    /**
     * @constructor
     * @param [token] - A Twilio JWT token string granting this {@link Device} access.
     * @param [options]
     */
    function Device(token, options) {
        var _a;
        var _this = _super.call(this) || this;
        /**
         * The AudioHelper instance associated with this {@link Device}.
         */
        _this.audio = null;
        /**
         * An array of connections. Though only one can be active, multiple may exist when there
         * are multiple incoming, unanswered connections.
         */
        _this.connections = [];
        /**
         * Whether or not Device.setup() has been called.
         */
        _this.isInitialized = false;
        /**
         * Methods to enable/disable each sound.
         */
        _this.sounds = {};
        /**
         * The JWT string currently being used to authenticate this {@link Device}.
         */
        _this.token = null;
        /**
         * The currently active {@link Connection}, if there is one.
         */
        _this._activeConnection = null;
        /**
         * An audio input MediaStream to pass to new {@link Connection} instances.
         */
        _this._connectionInputStream = null;
        /**
         * An array of {@link Device} IDs to be used to play sounds through, to be passed to
         * new {@link Connection} instances.
         */
        _this._connectionSinkIds = ['default'];
        /**
         * Whether each sound is enabled.
         */
        _this._enabledSounds = (_a = {},
            _a[SoundName.Disconnect] = true,
            _a[SoundName.Incoming] = true,
            _a[SoundName.Outgoing] = true,
            _a);
        /**
         * An instance of Log to use.
         */
        _this._log = new tslog_1.default(tslog_1.LogLevel.Off);
        /**
         * An Insights Event Publisher.
         */
        _this._publisher = null;
        /**
         * The region the {@link Device} is connected to.
         */
        _this._region = null;
        /**
         * The current status of the {@link Device}.
         */
        _this._status = DeviceStatus.Offline;
        /**
         * Value of 'audio' determines whether we should be registered for incoming calls.
         */
        _this.mediaPresence = { audio: true };
        /**
         * The options passed to {@link Device} constructor or Device.setup.
         */
        _this.options = {
            allowIncomingWhileBusy: false,
            audioConstraints: true,
            closeProtection: false,
            connectionFactory: connection_1.default,
            debug: false,
            dscp: true,
            eventgw: 'eventgw.twilio.com',
            iceServers: [],
            noRegister: false,
            pStreamFactory: pstream_1.PStream,
            region: regions_1.Region.Gll,
            rtcConstraints: {},
            soundFactory: Sound,
            sounds: {},
            warnings: true,
        };
        /**
         * A timeout ID for a setTimeout schedule to re-register the {@link Device}.
         */
        _this.regTimer = null;
        /**
         * A Map of Sounds to play.
         */
        _this.soundcache = new Map();
        /**
         * The Signaling stream.
         */
        _this.stream = null;
        /**
         * Create the default Insights payload
         * @param [connection]
         */
        _this._createDefaultPayload = function (connection) {
            var payload = {
                platform: rtc.getMediaEngine(),
                sdk_version: C.RELEASE_VERSION,
                selected_region: _this.options.region,
            };
            function setIfDefined(propertyName, value) {
                if (value) {
                    payload[propertyName] = value;
                }
            }
            if (connection) {
                var callSid = connection.parameters.CallSid;
                setIfDefined('call_sid', /^TJ/.test(callSid) ? null : callSid);
                setIfDefined('temp_call_sid', connection.outboundConnectionId);
                payload.direction = connection._direction;
            }
            var stream = _this.stream;
            if (stream) {
                setIfDefined('gateway', stream.gateway);
                setIfDefined('region', stream.region);
            }
            return payload;
        };
        /**
         * Disconnect all {@link Connection}s.
         */
        _this._disconnectAll = function () {
            var connections = _this.connections.splice(0);
            connections.forEach(function (conn) { return conn.disconnect(); });
            if (_this._activeConnection) {
                _this._activeConnection.disconnect();
            }
        };
        /**
         * Called when a 'close' event is received from the signaling stream.
         */
        _this._onSignalingClose = function () {
            _this.stream = null;
        };
        /**
         * Called when a 'connected' event is received from the signaling stream.
         */
        _this._onSignalingConnected = function (payload) {
            _this._region = regions_1.getRegionShortcode(payload.region) || payload.region;
            _this._sendPresence();
        };
        /**
         * Called when an 'error' event is received from the signaling stream.
         */
        _this._onSignalingError = function (payload) {
            var error = payload.error;
            if (!error) {
                return;
            }
            var sid = payload.callsid;
            if (sid) {
                error.connection = _this._findConnection(sid);
            }
            // Stop trying to register presence after token expires
            if (error.code === 31205) {
                _this._stopRegistrationTimer();
            }
            _this._log.info('Received error: ', error);
            _this.emit('error', error);
        };
        /**
         * Called when an 'invite' event is received from the signaling stream.
         */
        _this._onSignalingInvite = function (payload) {
            var wasBusy = !!_this._activeConnection;
            if (wasBusy && !_this.options.allowIncomingWhileBusy) {
                _this._log.info('Device busy; ignoring incoming invite');
                return;
            }
            if (!payload.callsid || !payload.sdp) {
                _this.emit('error', { message: 'Malformed invite from gateway' });
                return;
            }
            var callParameters = payload.parameters || {};
            callParameters.CallSid = callParameters.CallSid || payload.callsid;
            var customParameters = Object.assign({}, util_1.queryToJson(callParameters.Params));
            var connection = _this._makeConnection(customParameters, {
                callParameters: callParameters,
                offerSdp: payload.sdp,
            });
            _this.connections.push(connection);
            connection.once('accept', function () {
                _this.soundcache.get(SoundName.Incoming).stop();
            });
            var play = (_this._enabledSounds.incoming && !wasBusy)
                ? function () { return _this.soundcache.get(SoundName.Incoming).play(); }
                : function () { return Promise.resolve(); };
            _this._showIncomingConnection(connection, play);
        };
        /**
         * Called when an 'offline' event is received from the signaling stream.
         */
        _this._onSignalingOffline = function () {
            _this._log.info('Stream is offline');
            _this._status = DeviceStatus.Offline;
            _this._region = null;
            _this.emit('offline', _this);
        };
        /**
         * Called when a 'ready' event is received from the signaling stream.
         */
        _this._onSignalingReady = function () {
            _this._log.info('Stream is ready');
            _this._status = DeviceStatus.Ready;
            _this.emit('ready', _this);
        };
        /**
         * Update the input stream being used for calls so that any current call and all future calls
         * will use the new input stream.
         * @param inputStream
         */
        _this._updateInputStream = function (inputStream) {
            var connection = _this._activeConnection;
            if (connection && !inputStream) {
                return Promise.reject(new Error('Cannot unset input device while a call is in progress.'));
            }
            _this._connectionInputStream = inputStream;
            return connection
                ? connection._setInputTracksFromStream(inputStream)
                : Promise.resolve();
        };
        /**
         * Update the device IDs of output devices being used to play sounds through.
         * @param type - Whether to update ringtone or speaker sounds
         * @param sinkIds - An array of device IDs
         */
        _this._updateSinkIds = function (type, sinkIds) {
            var promise = type === 'ringtone'
                ? _this._updateRingtoneSinkIds(sinkIds)
                : _this._updateSpeakerSinkIds(sinkIds);
            return promise.then(function () {
                _this._publisher.info('audio', type + "-devices-set", {
                    audio_device_ids: sinkIds,
                }, _this._activeConnection);
            }, function (error) {
                _this._publisher.error('audio', type + "-devices-set-failed", {
                    audio_device_ids: sinkIds,
                    message: error.message,
                }, _this._activeConnection);
                throw error;
            });
        };
        if (token) {
            _this.setup(token, options);
        }
        else if (options) {
            throw new Error('Cannot construct a Device with options but without a token');
        }
        return _this;
    }
    Object.defineProperty(Device, "audioContext", {
        /**
         * The AudioContext to be used by {@link Device} instances.
         */
        get: function () {
            return Device._audioContext;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Device, "extension", {
        /**
         * Which sound file extension is supported.
         */
        get: function () {
            // NOTE(mroberts): Node workaround.
            var a = typeof document !== 'undefined'
                ? document.createElement('audio') : { canPlayType: false };
            var canPlayMp3;
            try {
                canPlayMp3 = a.canPlayType && !!a.canPlayType('audio/mpeg').replace(/no/, '');
            }
            catch (e) {
                canPlayMp3 = false;
            }
            var canPlayVorbis;
            try {
                canPlayVorbis = a.canPlayType && !!a.canPlayType('audio/ogg;codecs=\'vorbis\'').replace(/no/, '');
            }
            catch (e) {
                canPlayVorbis = false;
            }
            return (canPlayVorbis && !canPlayMp3) ? 'ogg' : 'mp3';
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Device, "isSupported", {
        /**
         * Whether or not this SDK is supported by the current browser.
         */
        get: function () { return rtc.enabled(); },
        enumerable: true,
        configurable: true
    });
    /**
     * String representation of {@link Device} class.
     */
    Device.toString = function () {
        return '[Twilio.Device class]';
    };
    /**
     * Return the active @{link Connection}. Null or undefined for backward compatibility.
     */
    Device.prototype.activeConnection = function () {
        if (!this.isInitialized) {
            return null;
        }
        // @rrowland This should only return activeConnection, but customers have built around this
        // broken behavior and in order to not break their apps we are including this until
        // the next big release.
        return this._activeConnection || this.connections[0];
    };
    /**
     * @deprecated - Set a handler for the cancel event.
     * @param handler
     */
    Device.prototype.cancel = function (handler) {
        return this._addHandler(DeviceEvent.Cancel, handler);
    };
    /**
     * @private
     */
    Device.prototype.connect = function (paramsOrHandler, audioConstraints) {
        if (typeof paramsOrHandler === 'function') {
            this._addHandler(DeviceEvent.Connect, paramsOrHandler);
            return null;
        }
        this._throwUnlessSetup('connect');
        if (this._activeConnection) {
            throw new Error('A Connection is already active');
        }
        var params = paramsOrHandler || {};
        audioConstraints = audioConstraints || this.options && this.options.audioConstraints || {};
        var connection = this._activeConnection = this._makeConnection(params);
        // Make sure any incoming connections are ignored
        this.connections.splice(0).forEach(function (conn) { return conn.ignore(); });
        // Stop the incoming sound if it's playing
        this.soundcache.get(SoundName.Incoming).stop();
        connection.accept(audioConstraints);
        return connection;
    };
    /**
     * Destroy the {@link Device}, freeing references to be garbage collected.
     */
    Device.prototype.destroy = function () {
        this._stopRegistrationTimer();
        if (this.audio) {
            this.audio._unbind();
        }
        if (this.stream) {
            this.stream.destroy();
            this.stream = null;
        }
        if (typeof window !== 'undefined' && window.removeEventListener) {
            window.removeEventListener('beforeunload', this._confirmClose);
            window.removeEventListener('unload', this._disconnectAll);
        }
    };
    /**
     * @deprecated - Set a handler for the disconnect event.
     * @param handler
     */
    Device.prototype.disconnect = function (handler) {
        return this._addHandler(DeviceEvent.Disconnect, handler);
    };
    /**
     * Disconnect all {@link Connection}s.
     */
    Device.prototype.disconnectAll = function () {
        this._throwUnlessSetup('disconnectAll');
        this._disconnectAll();
    };
    /**
     * @deprecated - Set a handler for the error event.
     * @param handler
     */
    Device.prototype.error = function (handler) {
        return this._addHandler(DeviceEvent.Error, handler);
    };
    /**
     * @deprecated - Set a handler for the incoming event.
     * @param handler
     */
    Device.prototype.incoming = function (handler) {
        return this._addHandler(DeviceEvent.Incoming, handler);
    };
    /**
     * @deprecated - Set a handler for the offline event.
     * @param handler
     */
    Device.prototype.offline = function (handler) {
        return this._addHandler(DeviceEvent.Offline, handler);
    };
    /**
     * @deprecated - Set a handler for the ready event.
     * @param handler
     */
    Device.prototype.ready = function (handler) {
        return this._addHandler(DeviceEvent.Ready, handler);
    };
    /**
     * Get the region the {@link Device} is currently connected to.
     */
    Device.prototype.region = function () {
        this._throwUnlessSetup('region');
        return typeof this._region === 'string' ? this._region : 'offline';
    };
    /**
     * Register to receive incoming calls.
     */
    Device.prototype.registerPresence = function () {
        this._throwUnlessSetup('registerPresence');
        this.mediaPresence.audio = true;
        this._sendPresence();
        return this;
    };
    /**
     * Initialize the {@link Device}.
     * @param token - A Twilio JWT token string granting this {@link Device} access.
     * @param [options]
     */
    Device.prototype.setup = function (token, options) {
        var _this = this;
        if (options === void 0) { options = {}; }
        if (!Device.isSupported && !options.ignoreBrowserSupport) {
            throw new util_1.Exception("twilio.js 1.3+ SDKs require WebRTC/ORTC browser support.         For more information, see <https://www.twilio.com/docs/api/client/twilio-js>.         If you have any questions about this announcement, please contact         Twilio Support at <help@twilio.com>.");
        }
        if (!token) {
            throw new util_1.Exception('Token is required for Device.setup()');
        }
        if (!Device._audioContext) {
            if (typeof AudioContext !== 'undefined') {
                Device._audioContext = new AudioContext();
            }
            else if (typeof webkitAudioContext !== 'undefined') {
                Device._audioContext = new webkitAudioContext();
            }
        }
        if (this.isInitialized) {
            this._log.info('Found existing Device; using new token but ignoring options');
            this.updateToken(token);
            return this;
        }
        this.isInitialized = true;
        Object.assign(this.options, options);
        if (this.options.dscp) {
            this.options.rtcConstraints.optional = [{ googDscp: true }];
        }
        this._log = new (this.options.Log || tslog_1.default)(this.options.debug ? tslog_1.LogLevel.Debug
            : this.options.warnings ? tslog_1.LogLevel.Warn
                : tslog_1.LogLevel.Off);
        var getOrSetSound = function (key, value) {
            if (!hasBeenWarnedSounds) {
                _this._log.warn('Device.sounds is deprecated and will be removed in the next breaking ' +
                    'release. Please use the new functionality available on Device.audio.');
                hasBeenWarnedSounds = true;
            }
            if (typeof value !== 'undefined') {
                _this._enabledSounds[key] = value;
            }
            return _this._enabledSounds[key];
        };
        [SoundName.Disconnect, SoundName.Incoming, SoundName.Outgoing].forEach(function (eventName) {
            _this.sounds[eventName] = getOrSetSound.bind(null, eventName);
        });
        var regionURI = regions_1.getRegionURI(this.options.region, function (newRegion) {
            _this._log.warn("Region " + _this.options.region + " is deprecated, please use " + newRegion + ".");
        });
        this.options.chunderw = "wss://" + (this.options.chunderw || regionURI) + "/signal";
        var defaultSounds = {
            disconnect: { filename: 'disconnect', maxDuration: 3000 },
            dtmf0: { filename: 'dtmf-0', maxDuration: 1000 },
            dtmf1: { filename: 'dtmf-1', maxDuration: 1000 },
            dtmf2: { filename: 'dtmf-2', maxDuration: 1000 },
            dtmf3: { filename: 'dtmf-3', maxDuration: 1000 },
            dtmf4: { filename: 'dtmf-4', maxDuration: 1000 },
            dtmf5: { filename: 'dtmf-5', maxDuration: 1000 },
            dtmf6: { filename: 'dtmf-6', maxDuration: 1000 },
            dtmf7: { filename: 'dtmf-7', maxDuration: 1000 },
            dtmf8: { filename: 'dtmf-8', maxDuration: 1000 },
            dtmf9: { filename: 'dtmf-9', maxDuration: 1000 },
            dtmfh: { filename: 'dtmf-hash', maxDuration: 1000 },
            dtmfs: { filename: 'dtmf-star', maxDuration: 1000 },
            incoming: { filename: 'incoming', shouldLoop: true },
            outgoing: { filename: 'outgoing', maxDuration: 3000 },
        };
        for (var _i = 0, _a = Object.keys(defaultSounds); _i < _a.length; _i++) {
            var name_1 = _a[_i];
            var soundDef = defaultSounds[name_1];
            var defaultUrl = C.SOUNDS_BASE_URL + "/" + soundDef.filename + "." + Device.extension + "?cache=1_4_23";
            var soundUrl = this.options.sounds && this.options.sounds[name_1] || defaultUrl;
            var sound = new this.options.soundFactory(name_1, soundUrl, {
                audioContext: this.options.disableAudioContextSounds ? null : Device.audioContext,
                maxDuration: soundDef.maxDuration,
                shouldLoop: soundDef.shouldLoop,
            });
            this.soundcache.set(name_1, sound);
        }
        this._publisher = (this.options.Publisher || Publisher)('twilio-js-sdk', token, {
            defaultPayload: this._createDefaultPayload,
            host: this.options.eventgw,
        });
        if (this.options.publishEvents === false) {
            this._publisher.disable();
        }
        this.audio = new (this.options.AudioHelper || AudioHelper)(this._updateSinkIds, this._updateInputStream, getUserMedia, {
            audioContext: Device.audioContext,
            enabledSounds: this._enabledSounds,
            logEnabled: !!this.options.debug,
            logWarnings: !!this.options.warnings,
        });
        this.audio.on('deviceChange', function (lostActiveDevices) {
            var activeConnection = _this._activeConnection;
            var deviceIds = lostActiveDevices.map(function (device) { return device.deviceId; });
            _this._publisher.info('audio', 'device-change', {
                lost_active_device_ids: deviceIds,
            }, activeConnection);
            if (activeConnection) {
                activeConnection.mediaStream._onInputDevicesChanged();
            }
        });
        this.mediaPresence.audio = !this.options.noRegister;
        this.updateToken(token);
        // Setup close protection and make sure we clean up ongoing calls on unload.
        if (typeof window !== 'undefined' && window.addEventListener) {
            window.addEventListener('unload', this._disconnectAll);
            if (this.options.closeProtection) {
                window.addEventListener('beforeunload', this._confirmClose);
            }
        }
        // (rrowland) This maintains backward compatibility, but we should look at
        // removing this next breaking change. Any error should be caught by the
        // customer, and anything that's not a fatal error should not be emitted
        // via error event.
        this.on('error', function () {
            if (_this.listenerCount('error') > 1) {
                return;
            }
            _this._log.info('Uncaught error event suppressed.');
        });
        return this;
    };
    /**
     * Get the status of this {@link Device} instance
     */
    Device.prototype.status = function () {
        this._throwUnlessSetup('status');
        return this._activeConnection ? DeviceStatus.Busy : this._status;
    };
    /**
     * String representation of {@link Device} instance.
     */
    Device.prototype.toString = function () {
        return '[Twilio.Device instance]';
    };
    /**
     * Unregister to receiving incoming calls.
     */
    Device.prototype.unregisterPresence = function () {
        this._throwUnlessSetup('unregisterPresence');
        this.mediaPresence.audio = false;
        this._sendPresence();
        return this;
    };
    /**
     * Update the token and re-register.
     * @param token - The new token JWT string to register with.
     */
    Device.prototype.updateToken = function (token) {
        this._throwUnlessSetup('updateToken');
        this.token = token;
        this.register(token);
    };
    /**
     * Register the {@link Device}
     * @param token
     */
    Device.prototype.register = function (token) {
        if (this.stream) {
            this.stream.setToken(token);
            this._publisher.setToken(token);
        }
        else {
            this._setupStream(token);
        }
    };
    /**
     * Add a handler for an EventEmitter and emit a deprecation warning on first call.
     * @param eventName - Name of the event
     * @param handler - A handler to call when the event is emitted
     */
    Device.prototype._addHandler = function (eventName, handler) {
        if (!hasBeenWarnedHandlers) {
            this._log.warn("Device callback handlers (connect, error, offline, incoming, cancel, ready, disconnect)         have been deprecated and will be removed in the next breaking release. Instead, the EventEmitter         interface can be used to set event listeners. Example: device.on('" + eventName + "', handler)");
            hasBeenWarnedHandlers = true;
        }
        this.addListener(eventName, handler);
        return this;
    };
    /**
     * Throw an Error if Device.setup has not been called for this instance.
     * @param methodName - The name of the method being called before setup()
     */
    Device.prototype._throwUnlessSetup = function (methodName) {
        if (!this.isInitialized) {
            throw new Error("Call Device.setup() before " + methodName);
        }
    };
    /**
     * Called on window's beforeunload event if closeProtection is enabled,
     * preventing users from accidentally navigating away from an active call.
     * @param event
     */
    Device.prototype._confirmClose = function (event) {
        if (!this._activeConnection) {
            return '';
        }
        var closeProtection = this.options.closeProtection || false;
        var confirmationMsg = typeof closeProtection !== 'string'
            ? 'A call is currently in-progress. Leaving or reloading this page will end the call.'
            : closeProtection;
        (event || window.event).returnValue = confirmationMsg;
        return confirmationMsg;
    };
    /**
     * Find a {@link Connection} by its CallSid.
     * @param callSid
     */
    Device.prototype._findConnection = function (callSid) {
        return this.connections.find(function (conn) { return conn.parameters.CallSid === callSid
            || conn.outboundConnectionId === callSid; }) || null;
    };
    /**
     * Create a new {@link Connection}.
     * @param twimlParams - A flat object containing key:value pairs to be sent to the TwiML app.
     * @param [options] - Options to be used to instantiate the {@link Connection}.
     */
    Device.prototype._makeConnection = function (twimlParams, options) {
        var _this = this;
        var config = {
            audioHelper: this.audio,
            getUserMedia: getUserMedia,
            pstream: this.stream,
            publisher: this._publisher,
            soundcache: this.soundcache,
        };
        options = Object.assign({
            MediaStream: this.options.MediaStream
                || this.options.mediaStreamFactory
                || rtc.PeerConnection,
            audioConstraints: this.options.audioConstraints,
            beforeAccept: function (conn) {
                if (!_this._activeConnection || _this._activeConnection === conn) {
                    return;
                }
                _this._activeConnection.disconnect();
                _this._removeConnection(_this._activeConnection);
            },
            debug: this.options.debug,
            enableRingingState: this.options.enableRingingState,
            getInputStream: function () { return _this._connectionInputStream; },
            getSinkIds: function () { return _this._connectionSinkIds; },
            iceServers: this.options.iceServers,
            rtcConstraints: this.options.rtcConstraints,
            shouldPlayDisconnect: this._enabledSounds.disconnect,
            twimlParams: twimlParams,
            warnings: this.options.warnings,
        }, options);
        var connection = new this.options.connectionFactory(config, options);
        connection.once('accept', function () {
            _this._removeConnection(connection);
            _this._activeConnection = connection;
            _this.audio._maybeStartPollingVolume();
            if (connection.direction === connection_1.CallDirection.Outgoing && _this._enabledSounds.outgoing) {
                _this.soundcache.get(SoundName.Outgoing).play();
            }
            _this.emit('connect', connection);
        });
        connection.addListener('error', function (error) {
            if (connection.status() === 'closed') {
                _this._removeConnection(connection);
            }
            _this.audio._maybeStopPollingVolume();
            _this._maybeStopIncomingSound();
            _this.emit('error', error);
        });
        connection.once('cancel', function () {
            _this._log.info("Canceled: " + connection.parameters.CallSid);
            _this._removeConnection(connection);
            _this.audio._maybeStopPollingVolume();
            _this._maybeStopIncomingSound();
            _this.emit('cancel', connection);
        });
        connection.once('disconnect', function () {
            _this.audio._maybeStopPollingVolume();
            _this._removeConnection(connection);
            _this.emit('disconnect', connection);
        });
        connection.once('reject', function () {
            _this._log.info("Rejected: " + connection.parameters.CallSid);
            _this.audio._maybeStopPollingVolume();
            _this._removeConnection(connection);
            _this._maybeStopIncomingSound();
        });
        return connection;
    };
    /**
     * Stop the incoming sound if no {@link Connection}s remain.
     */
    Device.prototype._maybeStopIncomingSound = function () {
        if (!this.connections.length) {
            this.soundcache.get(SoundName.Incoming).stop();
        }
    };
    /**
     * Remove a {@link Connection} from device.connections by reference
     * @param connection
     */
    Device.prototype._removeConnection = function (connection) {
        if (this._activeConnection === connection) {
            this._activeConnection = null;
        }
        for (var i = this.connections.length - 1; i >= 0; i--) {
            if (connection === this.connections[i]) {
                this.connections.splice(i, 1);
            }
        }
    };
    /**
     * Set up the connection to the signaling server.
     * @param token
     */
    Device.prototype._setupStream = function (token) {
        this._log.info('Setting up VSP');
        this.stream = this.options.pStreamFactory(token, this.options.chunderw, {
            debug: this.options.debug,
        });
        this.stream.addListener('close', this._onSignalingClose);
        this.stream.addListener('connected', this._onSignalingConnected);
        this.stream.addListener('error', this._onSignalingError);
        this.stream.addListener('invite', this._onSignalingInvite);
        this.stream.addListener('offline', this._onSignalingOffline);
        this.stream.addListener('ready', this._onSignalingReady);
    };
    /**
     * Register with the signaling server.
     */
    Device.prototype._sendPresence = function () {
        if (!this.stream) {
            return;
        }
        this.stream.register({ audio: this.mediaPresence.audio });
        if (this.mediaPresence.audio) {
            this._startRegistrationTimer();
        }
        else {
            this._stopRegistrationTimer();
        }
    };
    /**
     * Set a timeout to send another register message to the signaling server.
     */
    Device.prototype._startRegistrationTimer = function () {
        var _this = this;
        this._stopRegistrationTimer();
        this.regTimer = setTimeout(function () {
            _this._sendPresence();
        }, exports.REGISTRATION_INTERVAL);
    };
    /**
     * Stop sending registration messages to the signaling server.
     */
    Device.prototype._stopRegistrationTimer = function () {
        if (this.regTimer) {
            clearTimeout(this.regTimer);
        }
    };
    /**
     * Start playing the incoming ringtone, and subsequently emit the incoming event.
     * @param connection
     * @param play - The function to be used to play the sound. Must return a Promise.
     */
    Device.prototype._showIncomingConnection = function (connection, play) {
        var _this = this;
        var timeout;
        return Promise.race([
            play(),
            new Promise(function (resolve, reject) {
                timeout = setTimeout(function () {
                    reject(new Error('Playing incoming ringtone took too long; it might not play. Continuing execution...'));
                }, exports.RINGTONE_PLAY_TIMEOUT);
            }),
        ]).catch(function (reason) {
            _this._log.info(reason.message);
        }).then(function () {
            clearTimeout(timeout);
            _this.emit('incoming', connection);
        });
    };
    /**
     * Update the device IDs of output devices being used to play the incoming ringtone through.
     * @param sinkIds - An array of device IDs
     */
    Device.prototype._updateRingtoneSinkIds = function (sinkIds) {
        return Promise.resolve(this.soundcache.get(SoundName.Incoming).setSinkIds(sinkIds));
    };
    /**
     * Update the device IDs of output devices being used to play the non-ringtone sounds
     * and Call audio through.
     * @param sinkIds - An array of device IDs
     */
    Device.prototype._updateSpeakerSinkIds = function (sinkIds) {
        Array.from(this.soundcache.entries())
            .filter(function (entry) { return entry[0] !== SoundName.Incoming; })
            .forEach(function (entry) { return entry[1].setSinkIds(sinkIds); });
        this._connectionSinkIds = sinkIds;
        var connection = this._activeConnection;
        return connection
            ? connection._setSinkIds(sinkIds)
            : Promise.resolve();
    };
    return Device;
}(events_1.EventEmitter));
exports.default = Device;

},{"./audiohelper":4,"./connection":5,"./constants":6,"./eventpublisher":8,"./pstream":11,"./regions":12,"./rtc":15,"./rtc/getusermedia":14,"./sound":25,"./tslog":26,"./util":27,"events":40}],8:[function(require,module,exports){
var request = require('./request');
/**
 * Builds Endpoint Analytics (EA) event payloads and sends them to
 *   the EA server.
 * @constructor
 * @param {String} productName - Name of the product publishing events.
 * @param {String} token - The JWT token to use to authenticate with
 *   the EA server.
 * @param {EventPublisher.Options} options
 * @property {Boolean} isEnabled - Whether or not this publisher is publishing
 *   to the server. Currently ignores the request altogether, in the future this
 *   may store them in case publishing is re-enabled later. Defaults to true.
 */ /**
* @typedef {Object} EventPublisher.Options
* @property {String} [host='eventgw.twilio.com'] - The host address of the EA
*   server to publish to.
* @property {Object|Function} [defaultPayload] - A default payload to extend
*   when creating and sending event payloads. Also takes a function that
*   should return an object representing the default payload. This is
*   useful for fields that should always be present when they are
*   available, but are not always available.
*/
function EventPublisher(productName, token, options) {
    if (!(this instanceof EventPublisher)) {
        return new EventPublisher(productName, token, options);
    }
    // Apply default options
    options = Object.assign({
        defaultPayload: function () { return {}; },
        host: 'eventgw.twilio.com'
    }, options);
    var defaultPayload = options.defaultPayload;
    if (typeof defaultPayload !== 'function') {
        defaultPayload = function () { return Object.assign({}, options.defaultPayload); };
    }
    var isEnabled = true;
    Object.defineProperties(this, {
        _defaultPayload: { value: defaultPayload },
        _isEnabled: {
            get: function () { return isEnabled; },
            set: function (_isEnabled) { isEnabled = _isEnabled; }
        },
        _host: { value: options.host },
        _request: { value: options.request || request },
        _token: { value: token, writable: true },
        isEnabled: {
            enumerable: true,
            get: function () { return isEnabled; }
        },
        productName: { enumerable: true, value: productName },
        token: {
            enumerable: true,
            get: function () { return this._token; }
        }
    });
}
/**
 * Post to an EA server.
 * @private
 * @param {String} endpointName - Endpoint to post the event to
 * @param {String} level - ['debug', 'info', 'warning', 'error']
 * @param {String} group - The name of the group the event belongs to.
 * @param {String} name - The designated event name.
 * @param {?Object} [payload=null] - The payload to pass. This will be extended
 *    onto the default payload object, if one exists.
 * @param {?Connection} [connection=null] - The {@link Connection} which is posting this payload.
 * @param {?Boolean} [force=false] - Whether or not to send this even if
 *    publishing is disabled.
 * @returns {Promise} Fulfilled if the HTTP response is 20x.
 */
EventPublisher.prototype._post = function _post(endpointName, level, group, name, payload, connection, force) {
    if (!this.isEnabled && !force) {
        return Promise.resolve();
    }
    var event = {
        /* eslint-disable camelcase */
        publisher: this.productName,
        group: group,
        name: name,
        timestamp: (new Date()).toISOString(),
        level: level.toUpperCase(),
        payload_type: 'application/json',
        private: false,
        payload: (payload && payload.forEach) ?
            payload.slice(0) : Object.assign(this._defaultPayload(connection), payload)
        /* eslint-enable camelcase */
    };
    var requestParams = {
        url: "https://" + this._host + "/v4/" + endpointName,
        body: event,
        headers: {
            'Content-Type': 'application/json',
            'X-Twilio-Token': this.token
        }
    };
    var self = this;
    return new Promise(function (resolve, reject) {
        self._request.post(requestParams, function (err) {
            if (err) {
                reject(err);
            }
            else {
                resolve();
            }
        });
    });
};
/**
 * Post an event to the EA server. Use this method when the level
 *  is dynamic. Otherwise, it's better practice to use the sugar
 *  methods named for the specific level.
 * @param {String} level - ['debug', 'info', 'warning', 'error']
 * @param {String} group - The name of the group the event belongs to.
 * @param {String} name - The designated event name.
 * @param {?Object} [payload=null] - The payload to pass. This will be extended
 *    onto the default payload object, if one exists.
 * @param {?Connection} [connection=null] - The {@link Connection} which is posting this payload.
 * @returns {Promise} Fulfilled if the HTTP response is 20x.
 */
EventPublisher.prototype.post = function post(level, group, name, payload, connection, force) {
    return this._post('EndpointEvents', level, group, name, payload, connection, force);
};
/**
 * Post a debug-level event to the EA server.
 * @param {String} group - The name of the group the event belongs to.
 * @param {String} name - The designated event name.
 * @param {?Object} [payload=null] - The payload to pass. This will be extended
 *    onto the default payload object, if one exists.
 * @param {?Connection} [connection=null] - The {@link Connection} which is posting this payload.
 * @returns {Promise} Fulfilled if the HTTP response is 20x.
 */
EventPublisher.prototype.debug = function debug(group, name, payload, connection) {
    return this.post('debug', group, name, payload, connection);
};
/**
 * Post an info-level event to the EA server.
 * @param {String} group - The name of the group the event belongs to.
 * @param {String} name - The designated event name.
 * @param {?Object} [payload=null] - The payload to pass. This will be extended
 *    onto the default payload object, if one exists.
 * @param {?Connection} [connection=null] - The {@link Connection} which is posting this payload.
 * @returns {Promise} Fulfilled if the HTTP response is 20x.
 */
EventPublisher.prototype.info = function info(group, name, payload, connection) {
    return this.post('info', group, name, payload, connection);
};
/**
 * Post a warning-level event to the EA server.
 * @param {String} group - The name of the group the event belongs to.
 * @param {String} name - The designated event name.
 * @param {?Object} [payload=null] - The payload to pass. This will be extended
 *    onto the default payload object, if one exists.
 * @param {?Connection} [connection=null] - The {@link Connection} which is posting this payload.
 * @returns {Promise} Fulfilled if the HTTP response is 20x.
 */
EventPublisher.prototype.warn = function warn(group, name, payload, connection) {
    return this.post('warning', group, name, payload, connection);
};
/**
 * Post an error-level event to the EA server.
 * @param {String} group - The name of the group the event belongs to.
 * @param {String} name - The designated event name.
 * @param {?Object} [payload=null] - The payload to pass. This will be extended
 *    onto the default payload object, if one exists.
 * @param {?Connection} [connection=null] - The {@link Connection} which is posting this payload.
 * @returns {Promise} Fulfilled if the HTTP response is 20x.
 */
EventPublisher.prototype.error = function error(group, name, payload, connection) {
    return this.post('error', group, name, payload, connection);
};
/**
 * Post a metrics event to the EA server.
 * @param {String} group - The name of the group the event belongs to.
 * @param {String} name - The designated event name.
 * @param {Array<Object>} metrics - The metrics to post.
 * @param {?Object} [customFields] - Custom fields to append to each payload.
 * @returns {Promise} Fulfilled if the HTTP response is 20x.
 */
EventPublisher.prototype.postMetrics = function postMetrics(group, name, metrics, customFields) {
    var self = this;
    return new Promise(function (resolve) {
        var samples = metrics
            .map(formatMetric)
            .map(function (sample) { return Object.assign(sample, customFields); });
        resolve(self._post('EndpointMetrics', 'info', group, name, samples));
    });
};
/**
 * Update the token to use to authenticate requests.
 * @param {string} token
 * @returns {void}
 */
EventPublisher.prototype.setToken = function setToken(token) {
    this._token = token;
};
/**
 * Enable the publishing of events.
 */
EventPublisher.prototype.enable = function enable() {
    this._isEnabled = true;
};
/**
 * Disable the publishing of events.
 */
EventPublisher.prototype.disable = function disable() {
    this._isEnabled = false;
};
function formatMetric(sample) {
    return {
        /* eslint-disable camelcase */
        timestamp: (new Date(sample.timestamp)).toISOString(),
        total_packets_received: sample.totals.packetsReceived,
        total_packets_lost: sample.totals.packetsLost,
        total_packets_sent: sample.totals.packetsSent,
        total_bytes_received: sample.totals.bytesReceived,
        total_bytes_sent: sample.totals.bytesSent,
        packets_received: sample.packetsReceived,
        packets_lost: sample.packetsLost,
        packets_lost_fraction: sample.packetsLostFraction &&
            (Math.round(sample.packetsLostFraction * 100) / 100),
        audio_level_in: sample.audioInputLevel,
        audio_level_out: sample.audioOutputLevel,
        call_volume_input: sample.inputVolume,
        call_volume_output: sample.outputVolume,
        jitter: sample.jitter,
        rtt: sample.rtt,
        mos: sample.mos && (Math.round(sample.mos * 100) / 100)
        /* eslint-enable camelcase */
    };
}
module.exports = EventPublisher;

},{"./request":13}],9:[function(require,module,exports){
/**
 * Bestow logging powers.
 *
 * @exports mixinLog as Twilio.mixinLog
 * @memberOf Twilio
 *
 * @param {object} object The object to bestow logging powers to
 * @param {string} [prefix] Prefix log messages with this
 *
 * @return {object} Return the object passed in
 */
function mixinLog(object, prefix) {
    /**
     * Logs a message or object.
     *
     * <p>There are a few options available for the log mixin. Imagine an object
     * <code>foo</code> with this function mixed in:</p>
     *
     * <pre><code>var foo = {};
     * Twilio.mixinLog(foo);
     *
     * </code></pre>
     *
     * <p>To enable or disable the log: <code>foo.log.enabled = true</code></p>
     *
     * <p>To modify the prefix: <code>foo.log.prefix = 'Hello'</code></p>
     *
     * <p>To use a custom callback instead of <code>console.log</code>:
     * <code>foo.log.handler = function() { ... };</code></p>
     *
     * @param *args Messages or objects to be logged
     */
    function log() {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        if (!log.enabled) {
            return;
        }
        var format = log.prefix ? log.prefix + " " : '';
        for (var i = 0; i < args.length; i++) {
            var arg = args[i];
            log.handler(typeof arg === 'string'
                ? format + arg
                : arg);
        }
    }
    function defaultWarnHandler(x) {
        /* eslint-disable no-console */
        if (typeof console !== 'undefined') {
            if (typeof console.warn === 'function') {
                console.warn(x);
            }
            else if (typeof console.log === 'function') {
                console.log(x);
            }
        }
        /* eslint-enable no-console */
    }
    function deprecated() {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        if (!log.warnings) {
            return;
        }
        for (var i = 0; i < args.length; i++) {
            var arg = args[i];
            log.warnHandler(arg);
        }
    }
    log.enabled = true;
    log.prefix = prefix || '';
    /** @ignore */
    log.defaultHandler = function (x) {
        // eslint-disable-next-line no-console
        if (typeof console !== 'undefined') {
            console.log(x);
        }
    };
    log.handler = log.defaultHandler;
    log.warnings = true;
    log.defaultWarnHandler = defaultWarnHandler;
    log.warnHandler = log.defaultWarnHandler;
    log.deprecated = deprecated;
    log.warn = deprecated;
    object.log = log;
}
exports.mixinLog = mixinLog;

},{}],10:[function(require,module,exports){
var C = require('./constants');
var DEFAULT_TEST_SOUND_URL = C.SOUNDS_BASE_URL + "/outgoing.mp3";
/**
 * A smart collection containing a Set of active output devices.
 * @class
 * @private
 * @param {string} name - The name of this collection of devices. This will be returned
 *   with beforeChange.
 * @param {Map<string, MediaDeviceInfo>} A Map of the available devices by their device ID
 *   to search within for getting and setting devices. This Map may change externally.
 * @param {OutputDeviceCollection~beforeChange} beforeChange
 * @param {Boolean} isSupported - Whether or not this class is supported. If false,
 *   functionality will be replaced with console warnings.
 */ /**
* A callback to run before updating the collection after active devices are changed
*   via the public API. If this returns a Promise, the list of active devices will
*   not be updated until it is resolved.
* @callback OutputDeviceCollection~beforeChange
* @param {string} name - Name of the collection.
* @param {Array<MediaDeviceInfo>} devices - A list of MediaDeviceInfos representing the
*   now active set of devices.
*/
function OutputDeviceCollection(name, availableDevices, beforeChange, isSupported) {
    Object.defineProperties(this, {
        _activeDevices: { value: new Set() },
        _availableDevices: { value: availableDevices },
        _beforeChange: { value: beforeChange },
        _isSupported: { value: isSupported },
        _name: { value: name }
    });
}
/**
 * Delete a device from the collection. If no devices remain, the 'default'
 *   device will be added as the sole device. If no `default` device exists,
 *   the first available device will be used.
 * @private
 * @returns {Boolean} wasDeleted
 */
OutputDeviceCollection.prototype._delete = function _delete(device) {
    var wasDeleted = this._activeDevices.delete(device);
    var defaultDevice = this._availableDevices.get('default')
        || Array.from(this._availableDevices.values())[0];
    if (!this._activeDevices.size && defaultDevice) {
        this._activeDevices.add(defaultDevice);
    }
    // Call _beforeChange so that the implementation can react when a device is
    // removed or lost.
    var deviceIds = Array.from(this._activeDevices.values()).map(function (deviceInfo) { return deviceInfo.deviceId; });
    this._beforeChange(this._name, deviceIds);
    return wasDeleted;
};
/**
 * Get the current set of devices.
 * @returns {Set<MediaDeviceInfo>}
 */
OutputDeviceCollection.prototype.get = function get() {
    return this._activeDevices;
};
/**
 * Replace the current set of devices with a new set of devices.
 * @param {string|Array<string>} deviceIds - An ID or array of IDs
 *   of devices to replace the existing devices with.
 * @returns {Promise} - Rejects if this feature is not supported, any of the
 *    supplied IDs are not found, or no IDs are passed.
 */
OutputDeviceCollection.prototype.set = function set(deviceIds) {
    if (!this._isSupported) {
        return Promise.reject(new Error('This browser does not support audio output selection'));
    }
    deviceIds = Array.isArray(deviceIds) ? deviceIds : [deviceIds];
    if (!deviceIds.length) {
        return Promise.reject(new Error('Must specify at least one device to set'));
    }
    var missingIds = [];
    var devices = deviceIds.map(function (id) {
        var device = this._availableDevices.get(id);
        if (!device) {
            missingIds.push(id);
        }
        return device;
    }, this);
    if (missingIds.length) {
        return Promise.reject(new Error("Devices not found: " + missingIds.join(', ')));
    }
    var self = this;
    function updateDevices() {
        self._activeDevices.clear();
        devices.forEach(self._activeDevices.add, self._activeDevices);
    }
    return new Promise(function (resolve) {
        resolve(self._beforeChange(self._name, deviceIds));
    }).then(updateDevices);
};
/**
 * Test the devices by playing audio through them.
 * @param {?string} [soundUrl] - An optional URL. If none is specified, we will
 *   play a default test tone.
 * @returns {Promise} Succeeds if the underlying .play() methods' Promises succeed.
 */
OutputDeviceCollection.prototype.test = function test(soundUrl) {
    if (!this._isSupported) {
        return Promise.reject(new Error('This browser does not support audio output selection'));
    }
    soundUrl = soundUrl || DEFAULT_TEST_SOUND_URL;
    if (!this._activeDevices.size) {
        return Promise.reject(new Error('No active output devices to test'));
    }
    return Promise.all(Array.from(this._activeDevices).map(function (device) {
        var el = new Audio([soundUrl]);
        return el.setSinkId(device.deviceId).then(function () { return el.play(); });
    }));
};
module.exports = OutputDeviceCollection;

},{"./constants":6}],11:[function(require,module,exports){
var C = require('./constants');
var EventEmitter = require('events').EventEmitter;
var util = require('util');
var log = require('./log');
var WSTransport = require('./wstransport').default;
var PSTREAM_VERSION = '1.4';
/**
 * Constructor for PStream objects.
 *
 * @exports PStream as Twilio.PStream
 * @memberOf Twilio
 * @borrows EventEmitter#addListener as #addListener
 * @borrows EventEmitter#removeListener as #removeListener
 * @borrows EventEmitter#emit as #emit
 * @borrows EventEmitter#hasListener as #hasListener
 * @constructor
 * @param {string} token The Twilio capabilities JWT
 * @param {string} uri The PStream endpoint URI
 * @param {object} [options]
 * @config {boolean} [options.debug=false] Enable debugging
 */
function PStream(token, uri, options) {
    if (!(this instanceof PStream)) {
        return new PStream(token, uri, options);
    }
    var defaults = {
        logPrefix: '[PStream]',
        TransportFactory: WSTransport,
        debug: false
    };
    options = options || {};
    for (var prop in defaults) {
        if (prop in options)
            continue;
        options[prop] = defaults[prop];
    }
    this.options = options;
    this.token = token || '';
    this.status = 'disconnected';
    this.uri = uri;
    this.gateway = null;
    this.region = null;
    this._messageQueue = [];
    this._handleTransportClose = this._handleTransportClose.bind(this);
    this._handleTransportError = this._handleTransportError.bind(this);
    this._handleTransportMessage = this._handleTransportMessage.bind(this);
    this._handleTransportOpen = this._handleTransportOpen.bind(this);
    log.mixinLog(this, this.options.logPrefix);
    this.log.enabled = this.options.debug;
    // NOTE(mroberts): EventEmitter requires that we catch all errors.
    this.on('error', function () { });
    /*
     *events used by device
     *'invite',
     *'ready',
     *'error',
     *'offline',
     *
     *'cancel',
     *'presence',
     *'roster',
     *'answer',
     *'candidate',
     *'hangup'
     */
    var self = this;
    this.addListener('ready', function () {
        self.status = 'ready';
    });
    this.addListener('offline', function () {
        self.status = 'offline';
    });
    this.addListener('close', function () {
        self.log('Received "close" from server. Destroying PStream...');
        self._destroy();
    });
    this.transport = new this.options.TransportFactory(this.uri, {
        logLevel: this.options.debug ? 'debug' : 'off'
    });
    this.transport.on('close', this._handleTransportClose);
    this.transport.on('error', this._handleTransportError);
    this.transport.on('message', this._handleTransportMessage);
    this.transport.on('open', this._handleTransportOpen);
    this.transport.open();
    return this;
}
util.inherits(PStream, EventEmitter);
PStream.prototype._handleTransportClose = function () {
    if (this.status !== 'disconnected') {
        if (this.status !== 'offline') {
            this.emit('offline', this);
        }
        this.status = 'disconnected';
    }
};
PStream.prototype._handleTransportError = function (err) {
    this.emit('error', err);
};
PStream.prototype._handleTransportMessage = function (msg) {
    if (!msg || !msg.data || typeof msg.data !== 'string') {
        return;
    }
    var _a = JSON.parse(msg.data), type = _a.type, _b = _a.payload, payload = _b === void 0 ? {} : _b;
    this.gateway = payload.gateway || this.gateway;
    this.region = payload.region || this.region;
    this.emit(type, payload);
};
PStream.prototype._handleTransportOpen = function () {
    var _this = this;
    this.status = 'connected';
    this.setToken(this.token);
    var messages = this._messageQueue.splice(0, this._messageQueue.length);
    messages.forEach(function (message) { return _this._publish.apply(_this, message); });
};
/**
 * @return {string}
 */
PStream.toString = function () { return '[Twilio.PStream class]'; };
PStream.prototype.toString = function () { return '[Twilio.PStream instance]'; };
PStream.prototype.setToken = function (token) {
    this.log('Setting token and publishing listen');
    this.token = token;
    var payload = {
        token: token,
        browserinfo: getBrowserInfo()
    };
    this._publish('listen', payload);
};
PStream.prototype.register = function (mediaCapabilities) {
    var regPayload = {
        media: mediaCapabilities
    };
    this._publish('register', regPayload, true);
};
PStream.prototype._destroy = function () {
    this.transport.removeListener('close', this._handleTransportClose);
    this.transport.removeListener('error', this._handleTransportError);
    this.transport.removeListener('message', this._handleTransportMessage);
    this.transport.removeListener('open', this._handleTransportOpen);
    this.transport.close();
    this.emit('offline', this);
};
PStream.prototype.destroy = function () {
    this.log('PStream.destroy() called...');
    this._destroy();
    return this;
};
PStream.prototype.publish = function (type, payload) {
    return this._publish(type, payload, true);
};
PStream.prototype._publish = function (type, payload, shouldRetry) {
    var msg = JSON.stringify({
        type: type,
        version: PSTREAM_VERSION,
        payload: payload
    });
    if (!this.transport.send(msg) && shouldRetry) {
        this._messageQueue.push([type, payload, true]);
    }
};
function getBrowserInfo() {
    var nav = typeof navigator !== 'undefined' ? navigator : {};
    var info = {
        p: 'browser',
        v: C.RELEASE_VERSION,
        browser: {
            userAgent: nav.userAgent || 'unknown',
            platform: nav.platform || 'unknown'
        },
        plugin: 'rtc'
    };
    return info;
}
exports.PStream = PStream;

},{"./constants":6,"./log":9,"./wstransport":28,"events":40,"util":51}],12:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var _a, _b;
var util_1 = require("./util");
/**
 * Valid deprecated regions
 */
var DeprecatedRegion;
(function (DeprecatedRegion) {
    DeprecatedRegion["Au"] = "au";
    DeprecatedRegion["Br"] = "br";
    DeprecatedRegion["Ie"] = "ie";
    DeprecatedRegion["Jp"] = "jp";
    DeprecatedRegion["Sg"] = "sg";
    DeprecatedRegion["UsOr"] = "us-or";
    DeprecatedRegion["UsVa"] = "us-va";
})(DeprecatedRegion = exports.DeprecatedRegion || (exports.DeprecatedRegion = {}));
/**
 * Valid current regions
 */
var Region;
(function (Region) {
    Region["Au1"] = "au1";
    Region["Br1"] = "br1";
    Region["De1"] = "de1";
    Region["Gll"] = "gll";
    Region["Ie1"] = "ie1";
    Region["Ie1Ix"] = "ie1-ix";
    Region["Ie1Tnx"] = "ie1-tnx";
    Region["Jp1"] = "jp1";
    Region["Sg1"] = "sg1";
    Region["Us1"] = "us1";
    Region["Us1Ix"] = "us1-ix";
    Region["Us1Tnx"] = "us1-tnx";
    Region["Us2"] = "us2";
    Region["Us2Ix"] = "us2-ix";
    Region["Us2Tnx"] = "us2-tnx";
})(Region = exports.Region || (exports.Region = {}));
/**
 * Deprecated regions. Maps the deprecated region to its equivalent up-to-date region.
 */
var deprecatedRegions = (_a = {},
    _a[DeprecatedRegion.Au] = Region.Au1,
    _a[DeprecatedRegion.Br] = Region.Br1,
    _a[DeprecatedRegion.Ie] = Region.Ie1,
    _a[DeprecatedRegion.Jp] = Region.Jp1,
    _a[DeprecatedRegion.Sg] = Region.Sg1,
    _a[DeprecatedRegion.UsOr] = Region.Us1,
    _a[DeprecatedRegion.UsVa] = Region.Us1,
    _a);
/**
 * Region shortcodes. Maps the full region name from AWS to the Twilio shortcode.
 */
exports.regionShortcodes = {
    ASIAPAC_SINGAPORE: Region.Sg1,
    ASIAPAC_SYDNEY: Region.Au1,
    ASIAPAC_TOKYO: Region.Jp1,
    EU_FRANKFURT: Region.De1,
    EU_IRELAND: Region.Ie1,
    SOUTH_AMERICA_SAO_PAULO: Region.Br1,
    US_EAST_VIRGINIA: Region.Us1,
    US_WEST_OREGON: Region.Us2,
};
/**
 * Region URIs. Maps the Twilio shortcode to its Twilio endpoint URI.
 */
var regionURIs = (_b = {},
    _b[Region.Au1] = 'chunderw-vpc-gll-au1.twilio.com',
    _b[Region.Br1] = 'chunderw-vpc-gll-br1.twilio.com',
    _b[Region.De1] = 'chunderw-vpc-gll-de1.twilio.com',
    _b[Region.Gll] = 'chunderw-vpc-gll.twilio.com',
    _b[Region.Ie1] = 'chunderw-vpc-gll-ie1.twilio.com',
    _b[Region.Ie1Ix] = 'chunderw-vpc-gll-ie1-ix.twilio.com',
    _b[Region.Ie1Tnx] = 'chunderw-vpc-gll-ie1-tnx.twilio.com',
    _b[Region.Jp1] = 'chunderw-vpc-gll-jp1.twilio.com',
    _b[Region.Sg1] = 'chunderw-vpc-gll-sg1.twilio.com',
    _b[Region.Us1] = 'chunderw-vpc-gll-us1.twilio.com',
    _b[Region.Us1Ix] = 'chunderw-vpc-gll-us1-ix.twilio.com',
    _b[Region.Us1Tnx] = 'chunderw-vpc-gll-us1-tnx.twilio.com',
    _b[Region.Us2] = 'chunderw-vpc-gll-us2.twilio.com',
    _b[Region.Us2Ix] = 'chunderw-vpc-gll-us2-ix.twilio.com',
    _b[Region.Us2Tnx] = 'chunderw-vpc-gll-us2-tnx.twilio.com',
    _b);
/**
 * Get the URI associated with the passed shortcode.
 * @param region - The region shortcode. Defaults to gll.
 * @param [onDeprecated] - A callback containing the new region to be called when the passed region
 *   is deprecated.
 */
function getRegionURI(region, onDeprecated) {
    if (region === void 0) { region = Region.Gll; }
    if (Object.values(DeprecatedRegion).includes(region)) {
        region = deprecatedRegions[region];
        // Don't let this callback affect script execution.
        if (onDeprecated) {
            setTimeout(function () { return onDeprecated(region); });
        }
    }
    else if (!Object.values(Region).includes(region)) {
        throw new util_1.Exception("Region " + region + " is invalid. Valid values are: " + Object.keys(regionURIs).join(', '));
    }
    return regionURIs[region];
}
exports.getRegionURI = getRegionURI;
/**
 * Get the region shortcode by its full AWS region string.
 * @param region - The region's full AWS string.
 */
function getRegionShortcode(region) {
    return exports.regionShortcodes[region] || null;
}
exports.getRegionShortcode = getRegionShortcode;

},{"./util":27}],13:[function(require,module,exports){
var XHR = require('xmlhttprequest').XMLHttpRequest;
function request(method, params, callback) {
    var options = {};
    options.XMLHttpRequest = options.XMLHttpRequest || XHR;
    var xhr = new options.XMLHttpRequest();
    xhr.open(method, params.url, true);
    xhr.onreadystatechange = function onreadystatechange() {
        if (xhr.readyState !== 4) {
            return;
        }
        if (200 <= xhr.status && xhr.status < 300) {
            callback(null, xhr.responseText);
            return;
        }
        callback(new Error(xhr.responseText));
    };
    for (var headerName in params.headers) {
        xhr.setRequestHeader(headerName, params.headers[headerName]);
    }
    xhr.send(JSON.stringify(params.body));
}
/**
 * Use XMLHttpRequest to get a network resource.
 * @param {String} method - HTTP Method
 * @param {Object} params - Request parameters
 * @param {String} params.url - URL of the resource
 * @param {Array}  params.headers - An array of headers to pass [{ headerName : headerBody }]
 * @param {Object} params.body - A JSON body to send to the resource
 * @returns {response}
 **/
var Request = request;
/**
 * Sugar function for request('GET', params, callback);
 * @param {Object} params - Request parameters
 * @param {Request~get} callback - The callback that handles the response.
 */
Request.get = function get(params, callback) {
    return new this('GET', params, callback);
};
/**
 * Sugar function for request('POST', params, callback);
 * @param {Object} params - Request parameters
 * @param {Request~post} callback - The callback that handles the response.
 */
Request.post = function post(params, callback) {
    return new this('POST', params, callback);
};
module.exports = Request;

},{"xmlhttprequest":2}],14:[function(require,module,exports){
var util = require('../util');
function getUserMedia(constraints, options) {
    options = options || {};
    options.util = options.util || util;
    options.navigator = options.navigator
        || (typeof navigator !== 'undefined' ? navigator : null);
    return new Promise(function (resolve, reject) {
        if (!options.navigator) {
            throw new Error('getUserMedia is not supported');
        }
        switch ('function') {
            case typeof (options.navigator.mediaDevices && options.navigator.mediaDevices.getUserMedia):
                return resolve(options.navigator.mediaDevices.getUserMedia(constraints));
            case typeof options.navigator.webkitGetUserMedia:
                return options.navigator.webkitGetUserMedia(constraints, resolve, reject);
            case typeof options.navigator.mozGetUserMedia:
                return options.navigator.mozGetUserMedia(constraints, resolve, reject);
            case typeof options.navigator.getUserMedia:
                return options.navigator.getUserMedia(constraints, resolve, reject);
            default:
                throw new Error('getUserMedia is not supported');
        }
    }).catch(function (e) {
        throw (options.util.isFirefox() && e.name === 'NotReadableError')
            ? new Error('Firefox does not currently support opening multiple audio input tracks' +
                'simultaneously, even across different tabs.\n' +
                'Related Bugzilla thread: https://bugzilla.mozilla.org/show_bug.cgi?id=1299324')
            : e;
    });
}
module.exports = getUserMedia;

},{"../util":27}],15:[function(require,module,exports){
var PeerConnection = require('./peerconnection');
var test = require('./rtcpc').test;
function enabled() {
    return test();
}
function getMediaEngine() {
    return typeof RTCIceGatherer !== 'undefined' ? 'ORTC' : 'WebRTC';
}
module.exports = {
    enabled: enabled,
    getMediaEngine: getMediaEngine,
    PeerConnection: PeerConnection
};

},{"./peerconnection":19,"./rtcpc":20}],16:[function(require,module,exports){
/**
 * This file was imported from another project. If making changes to this file, please don't
 * make them here. Make them on the linked repo below, then copy back:
 * https://code.hq.twilio.com/client/MockRTCStatsReport
 */
/* eslint-disable no-undefined */
// The legacy max volume, which is the positive half of a signed short integer.
var OLD_MAX_VOLUME = 32767;
var NativeRTCStatsReport = typeof window !== 'undefined'
    ? window.RTCStatsReport : undefined;
/**
 * Create a MockRTCStatsReport wrapper around a Map of RTCStats objects. If RTCStatsReport is available
 *   natively, it will be inherited so that instanceof checks pass.
 * @constructor
 * @extends RTCStatsReport
 * @param {Map<string, RTCStats>} statsMap - A Map of RTCStats objects to wrap
 *   with a MockRTCStatsReport object.
 */
function MockRTCStatsReport(statsMap) {
    if (!(this instanceof MockRTCStatsReport)) {
        return new MockRTCStatsReport(statsMap);
    }
    var self = this;
    Object.defineProperties(this, {
        size: {
            enumerable: true,
            get: function () {
                return self._map.size;
            }
        },
        _map: { value: statsMap }
    });
    this[Symbol.iterator] = statsMap[Symbol.iterator];
}
// If RTCStatsReport is available natively, inherit it. Keep our constructor.
if (NativeRTCStatsReport) {
    MockRTCStatsReport.prototype = Object.create(NativeRTCStatsReport.prototype);
    MockRTCStatsReport.prototype.constructor = MockRTCStatsReport;
}
// Map the Map-like read methods to the underlying Map
['entries', 'forEach', 'get', 'has', 'keys', 'values'].forEach(function (key) {
    MockRTCStatsReport.prototype[key] = function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        var _a;
        return (_a = this._map)[key].apply(_a, args);
    };
});
/**
 * Convert an array of RTCStats objects into a mock RTCStatsReport object.
 * @param {Array<RTCStats>}
 * @return {MockRTCStatsReport}
 */
MockRTCStatsReport.fromArray = function fromArray(array) {
    return new MockRTCStatsReport(array.reduce(function (map, rtcStats) {
        map.set(rtcStats.id, rtcStats);
        return map;
    }, new Map()));
};
/**
 * Convert a legacy RTCStatsResponse object into a mock RTCStatsReport object.
 * @param {RTCStatsResponse} statsResponse - An RTCStatsResponse object returned by the
 *   legacy getStats(callback) method in Chrome.
 * @return {MockRTCStatsReport} A mock RTCStatsReport object.
 */
MockRTCStatsReport.fromRTCStatsResponse = function fromRTCStatsResponse(statsResponse) {
    var activeCandidatePairId;
    var transportIds = new Map();
    var statsMap = statsResponse.result().reduce(function (map, report) {
        var id = report.id;
        switch (report.type) {
            case 'googCertificate':
                map.set(id, createRTCCertificateStats(report));
                break;
            case 'datachannel':
                map.set(id, createRTCDataChannelStats(report));
                break;
            case 'googCandidatePair':
                if (getBoolean(report, 'googActiveConnection')) {
                    activeCandidatePairId = id;
                }
                map.set(id, createRTCIceCandidatePairStats(report));
                break;
            case 'localcandidate':
                map.set(id, createRTCIceCandidateStats(report, false));
                break;
            case 'remotecandidate':
                map.set(id, createRTCIceCandidateStats(report, true));
                break;
            case 'ssrc':
                if (isPresent(report, 'packetsReceived')) {
                    map.set("rtp-" + id, createRTCInboundRTPStreamStats(report));
                }
                else {
                    map.set("rtp-" + id, createRTCOutboundRTPStreamStats(report));
                }
                map.set("track-" + id, createRTCMediaStreamTrackStats(report));
                map.set("codec-" + id, createRTCCodecStats(report));
                break;
            case 'googComponent':
                var transportReport = createRTCTransportStats(report);
                transportIds.set(transportReport.selectedCandidatePairId, id);
                map.set(id, createRTCTransportStats(report));
                break;
        }
        return map;
    }, new Map());
    if (activeCandidatePairId) {
        var activeTransportId = transportIds.get(activeCandidatePairId);
        if (activeTransportId) {
            statsMap.get(activeTransportId).dtlsState = 'connected';
        }
    }
    return new MockRTCStatsReport(statsMap);
};
/**
 * @param {RTCLegacyStatsReport} report
 * @returns {RTCTransportStats}
 */
function createRTCTransportStats(report) {
    return {
        type: 'transport',
        id: report.id,
        timestamp: Date.parse(report.timestamp),
        bytesSent: undefined,
        bytesReceived: undefined,
        rtcpTransportStatsId: undefined,
        dtlsState: undefined,
        selectedCandidatePairId: report.stat('selectedCandidatePairId'),
        localCertificateId: report.stat('localCertificateId'),
        remoteCertificateId: report.stat('remoteCertificateId')
    };
}
/**
 * @param {RTCLegacyStatsReport} report
 * @returns {RTCCodecStats}
 */
function createRTCCodecStats(report) {
    return {
        type: 'codec',
        id: report.id,
        timestamp: Date.parse(report.timestamp),
        payloadType: undefined,
        mimeType: report.stat('mediaType') + "/" + report.stat('googCodecName'),
        clockRate: undefined,
        channels: undefined,
        sdpFmtpLine: undefined,
        implementation: undefined
    };
}
/**
 * @param {RTCLegacyStatsReport} report
 * @returns {RTCMediaStreamTrackStats}
 */
function createRTCMediaStreamTrackStats(report) {
    return {
        type: 'track',
        id: report.id,
        timestamp: Date.parse(report.timestamp),
        trackIdentifier: report.stat('googTrackId'),
        remoteSource: undefined,
        ended: undefined,
        kind: report.stat('mediaType'),
        detached: undefined,
        ssrcIds: undefined,
        frameWidth: isPresent(report, 'googFrameWidthReceived')
            ? getInt(report, 'googFrameWidthReceived')
            : getInt(report, 'googFrameWidthSent'),
        frameHeight: isPresent(report, 'googFrameHeightReceived')
            ? getInt(report, 'googFrameHeightReceived')
            : getInt(report, 'googFrameHeightSent'),
        framesPerSecond: undefined,
        framesSent: getInt(report, 'framesEncoded'),
        framesReceived: undefined,
        framesDecoded: getInt(report, 'framesDecoded'),
        framesDropped: undefined,
        framesCorrupted: undefined,
        partialFramesLost: undefined,
        fullFramesLost: undefined,
        audioLevel: isPresent(report, 'audioOutputLevel')
            ? getInt(report, 'audioOutputLevel') / OLD_MAX_VOLUME
            : (getInt(report, 'audioInputLevel') || 0) / OLD_MAX_VOLUME,
        echoReturnLoss: getFloat(report, 'googEchoCancellationReturnLoss'),
        echoReturnLossEnhancement: getFloat(report, 'googEchoCancellationReturnLossEnhancement')
    };
}
/**
 * @param {RTCLegacyStatsReport} report
 * @param {boolean} isInbound - Whether to create an inbound stats object, or outbound.
 * @returns {RTCRTPStreamStats}
 */
function createRTCRTPStreamStats(report, isInbound) {
    return {
        id: report.id,
        timestamp: Date.parse(report.timestamp),
        ssrc: report.stat('ssrc'),
        associateStatsId: undefined,
        isRemote: undefined,
        mediaType: report.stat('mediaType'),
        trackId: "track-" + report.id,
        transportId: report.stat('transportId'),
        codecId: "codec-" + report.id,
        firCount: isInbound
            ? getInt(report, 'googFirsSent')
            : undefined,
        pliCount: isInbound
            ? getInt(report, 'googPlisSent')
            : getInt(report, 'googPlisReceived'),
        nackCount: isInbound
            ? getInt(report, 'googNacksSent')
            : getInt(report, 'googNacksReceived'),
        sliCount: undefined,
        qpSum: getInt(report, 'qpSum')
    };
}
/**
 * @param {RTCLegacyStatsReport} report
 * @returns {RTCInboundRTPStreamStats}
 */
function createRTCInboundRTPStreamStats(report) {
    var rtp = createRTCRTPStreamStats(report, true);
    Object.assign(rtp, {
        type: 'inbound-rtp',
        packetsReceived: getInt(report, 'packetsReceived'),
        bytesReceived: getInt(report, 'bytesReceived'),
        packetsLost: getInt(report, 'packetsLost'),
        jitter: convertMsToSeconds(report.stat('googJitterReceived')),
        fractionLost: undefined,
        roundTripTime: convertMsToSeconds(report.stat('googRtt')),
        packetsDiscarded: undefined,
        packetsRepaired: undefined,
        burstPacketsLost: undefined,
        burstPacketsDiscarded: undefined,
        burstLossCount: undefined,
        burstDiscardCount: undefined,
        burstLossRate: undefined,
        burstDiscardRate: undefined,
        gapLossRate: undefined,
        gapDiscardRate: undefined,
        framesDecoded: getInt(report, 'framesDecoded')
    });
    return rtp;
}
/**
 * @param {RTCLegacyStatsReport} report
 * @returns {RTCOutboundRTPStreamStats}
 */
function createRTCOutboundRTPStreamStats(report) {
    var rtp = createRTCRTPStreamStats(report, false);
    Object.assign(rtp, {
        type: 'outbound-rtp',
        remoteTimestamp: undefined,
        packetsSent: getInt(report, 'packetsSent'),
        bytesSent: getInt(report, 'bytesSent'),
        targetBitrate: undefined,
        framesEncoded: getInt(report, 'framesEncoded')
    });
    return rtp;
}
/**
 * @param {RTCLegacyStatsReport} report
 * @param {boolean} isRemote - Whether to create for a remote candidate, or local candidate.
 * @returns {RTCIceCandidateStats}
 */
function createRTCIceCandidateStats(report, isRemote) {
    return {
        type: isRemote
            ? 'remote-candidate'
            : 'local-candidate',
        id: report.id,
        timestamp: Date.parse(report.timestamp),
        transportId: undefined,
        isRemote: isRemote,
        ip: report.stat('ipAddress'),
        port: getInt(report, 'portNumber'),
        protocol: report.stat('transport'),
        candidateType: translateCandidateType(report.stat('candidateType')),
        priority: getFloat(report, 'priority'),
        url: undefined,
        relayProtocol: undefined,
        deleted: undefined
    };
}
/**
 * @param {RTCLegacyStatsReport} report
 * @returns {RTCIceCandidatePairStats}
 */
function createRTCIceCandidatePairStats(report) {
    return {
        type: 'candidate-pair',
        id: report.id,
        timestamp: Date.parse(report.timestamp),
        transportId: report.stat('googChannelId'),
        localCandidateId: report.stat('localCandidateId'),
        remoteCandidateId: report.stat('remoteCandidateId'),
        state: undefined,
        priority: undefined,
        nominated: undefined,
        writable: getBoolean(report, 'googWritable'),
        readable: undefined,
        bytesSent: getInt(report, 'bytesSent'),
        bytesReceived: getInt(report, 'bytesReceived'),
        lastPacketSentTimestamp: undefined,
        lastPacketReceivedTimestamp: undefined,
        totalRoundTripTime: undefined,
        currentRoundTripTime: convertMsToSeconds(report.stat('googRtt')),
        availableOutgoingBitrate: undefined,
        availableIncomingBitrate: undefined,
        requestsReceived: getInt(report, 'requestsReceived'),
        requestsSent: getInt(report, 'requestsSent'),
        responsesReceived: getInt(report, 'responsesReceived'),
        responsesSent: getInt(report, 'responsesSent'),
        retransmissionsReceived: undefined,
        retransmissionsSent: undefined,
        consentRequestsSent: getInt(report, 'consentRequestsSent')
    };
}
/**
 * @param {RTCLegacyStatsReport} report
 * @returns {RTCIceCertificateStats}
 */
function createRTCCertificateStats(report) {
    return {
        type: 'certificate',
        id: report.id,
        timestamp: Date.parse(report.timestamp),
        fingerprint: report.stat('googFingerprint'),
        fingerprintAlgorithm: report.stat('googFingerprintAlgorithm'),
        base64Certificate: report.stat('googDerBase64'),
        issuerCertificateId: report.stat('googIssuerId')
    };
}
/**
 * @param {RTCLegacyStatsReport} report
 * @returns {RTCDataChannelStats}
 */
function createRTCDataChannelStats(report) {
    return {
        type: 'data-channel',
        id: report.id,
        timestamp: Date.parse(report.timestamp),
        label: report.stat('label'),
        protocol: report.stat('protocol'),
        datachannelid: report.stat('datachannelid'),
        transportId: report.stat('transportId'),
        state: report.stat('state'),
        messagesSent: undefined,
        bytesSent: undefined,
        messagesReceived: undefined,
        bytesReceived: undefined
    };
}
/**
 * @param {number} inMs - A time in milliseconds
 * @returns {number} The time in seconds
 */
function convertMsToSeconds(inMs) {
    return isNaN(inMs) || inMs === ''
        ? undefined
        : parseInt(inMs, 10) / 1000;
}
/**
 * @param {string} type - A type in the legacy format
 * @returns {string} The type adjusted to new standards for known naming changes
 */
function translateCandidateType(type) {
    switch (type) {
        case 'peerreflexive':
            return 'prflx';
        case 'serverreflexive':
            return 'srflx';
        case 'host':
        case 'relay':
        default:
            return type;
    }
}
function getInt(report, statName) {
    var stat = report.stat(statName);
    return isPresent(report, statName)
        ? parseInt(stat, 10)
        : undefined;
}
function getFloat(report, statName) {
    var stat = report.stat(statName);
    return isPresent(report, statName)
        ? parseFloat(stat)
        : undefined;
}
function getBoolean(report, statName) {
    var stat = report.stat(statName);
    return isPresent(report, statName)
        ? (stat === 'true' || stat === true)
        : undefined;
}
function isPresent(report, statName) {
    var stat = report.stat(statName);
    return typeof stat !== 'undefined' && stat !== '';
}
module.exports = MockRTCStatsReport;

},{}],17:[function(require,module,exports){
var EventEmitter = require('events').EventEmitter;
var getStatistics = require('./stats');
var inherits = require('util').inherits;
var Mos = require('./mos');
// How many samples we use when testing metric thresholds
var SAMPLE_COUNT_METRICS = 5;
// How many samples that need to cross the threshold to
// raise or clear a warning.
var SAMPLE_COUNT_CLEAR = 0;
var SAMPLE_COUNT_RAISE = 3;
var SAMPLE_INTERVAL = 1000;
var WARNING_TIMEOUT = 5 * 1000;
/**
 * @typedef {Object} RTCMonitor.ThresholdOptions
 * @property {RTCMonitor.ThresholdOption} [audioInputLevel] - Rules to apply to sample.audioInputLevel
 * @property {RTCMonitor.ThresholdOption} [audioOutputLevel] - Rules to apply to sample.audioOutputLevel
 * @property {RTCMonitor.ThresholdOption} [packetsLostFraction] - Rules to apply to sample.packetsLostFraction
 * @property {RTCMonitor.ThresholdOption} [jitter] - Rules to apply to sample.jitter
 * @property {RTCMonitor.ThresholdOption} [rtt] - Rules to apply to sample.rtt
 * @property {RTCMonitor.ThresholdOption} [mos] - Rules to apply to sample.mos
 */ /**
* @typedef {Object} RTCMonitor.ThresholdOption
* @property {?Number} [min] - Warning will be raised if tracked metric falls below this value.
* @property {?Number} [max] - Warning will be raised if tracked metric rises above this value.
* @property {?Number} [maxDuration] - Warning will be raised if tracked metric stays constant for
*   the specified number of consequent samples.
*/
var DEFAULT_THRESHOLDS = {
    audioInputLevel: { maxDuration: 10 },
    audioOutputLevel: { maxDuration: 10 },
    packetsLostFraction: { max: 1 },
    jitter: { max: 30 },
    rtt: { max: 400 },
    mos: { min: 3 }
};
/**
 * RTCMonitor polls a peerConnection via PeerConnection.getStats
 * and emits warnings when stats cross the specified threshold values.
 * @constructor
 * @param {RTCMonitor.Options} [options] - Config options for RTCMonitor.
 */ /**
* @typedef {Object} RTCMonitor.Options
* @property {PeerConnection} [peerConnection] - The PeerConnection to monitor.
* @property {RTCMonitor.ThresholdOptions} [thresholds] - Optional custom threshold values.
*/
function RTCMonitor(options) {
    if (!(this instanceof RTCMonitor)) {
        return new RTCMonitor(options);
    }
    options = options || {};
    var thresholds = Object.assign({}, DEFAULT_THRESHOLDS, options.thresholds);
    Object.defineProperties(this, {
        _activeWarnings: { value: new Map() },
        _currentStreaks: { value: new Map() },
        _peerConnection: { value: options.peerConnection, writable: true },
        _sampleBuffer: { value: [] },
        _sampleInterval: { value: null, writable: true },
        _thresholds: { value: thresholds },
        _warningsEnabled: { value: true, writable: true }
    });
    if (options.peerConnection) {
        this.enable();
    }
    EventEmitter.call(this);
}
inherits(RTCMonitor, EventEmitter);
/**
 * Create a sample object from a stats object using the previous sample,
 *   if available.
 * @param {Object} stats - Stats retrieved from getStatistics
 * @param {?Object} [previousSample=null] - The previous sample to use to calculate deltas.
 * @returns {Promise<RTCSample>}
 */
RTCMonitor.createSample = function createSample(stats, previousSample) {
    var previousPacketsSent = previousSample && previousSample.totals.packetsSent || 0;
    var previousPacketsReceived = previousSample && previousSample.totals.packetsReceived || 0;
    var previousPacketsLost = previousSample && previousSample.totals.packetsLost || 0;
    var currentPacketsSent = stats.packetsSent - previousPacketsSent;
    var currentPacketsReceived = stats.packetsReceived - previousPacketsReceived;
    var currentPacketsLost = stats.packetsLost - previousPacketsLost;
    var currentInboundPackets = currentPacketsReceived + currentPacketsLost;
    var currentPacketsLostFraction = (currentInboundPackets > 0) ?
        (currentPacketsLost / currentInboundPackets) * 100 : 0;
    var totalInboundPackets = stats.packetsReceived + stats.packetsLost;
    var totalPacketsLostFraction = (totalInboundPackets > 0) ?
        (stats.packetsLost / totalInboundPackets) * 100 : 100;
    return {
        timestamp: stats.timestamp,
        totals: {
            packetsReceived: stats.packetsReceived,
            packetsLost: stats.packetsLost,
            packetsSent: stats.packetsSent,
            packetsLostFraction: totalPacketsLostFraction,
            bytesReceived: stats.bytesReceived,
            bytesSent: stats.bytesSent
        },
        packetsSent: currentPacketsSent,
        packetsReceived: currentPacketsReceived,
        packetsLost: currentPacketsLost,
        packetsLostFraction: currentPacketsLostFraction,
        audioInputLevel: stats.audioInputLevel,
        audioOutputLevel: stats.audioOutputLevel,
        jitter: stats.jitter,
        rtt: stats.rtt,
        mos: Mos.calculate(stats, previousSample && currentPacketsLostFraction)
    };
};
/**
 * Start sampling RTC statistics for this {@link RTCMonitor}.
 * @param {PeerConnection} [peerConnection] - A PeerConnection to monitor.
 * @throws {Error} Attempted to replace an existing PeerConnection in RTCMonitor.enable
 * @throws {Error} Can not enable RTCMonitor without a PeerConnection
 * @returns {RTCMonitor} This RTCMonitor instance.
 */
RTCMonitor.prototype.enable = function enable(peerConnection) {
    if (peerConnection) {
        if (this._peerConnection && peerConnection !== this._peerConnection) {
            throw new Error('Attempted to replace an existing PeerConnection in RTCMonitor.enable');
        }
        this._peerConnection = peerConnection;
    }
    if (!this._peerConnection) {
        throw new Error('Can not enable RTCMonitor without a PeerConnection');
    }
    this._sampleInterval = this._sampleInterval ||
        setInterval(this._fetchSample.bind(this), SAMPLE_INTERVAL);
    return this;
};
/**
 * Stop sampling RTC statistics for this {@link RTCMonitor}.
 * @returns {RTCMonitor} This RTCMonitor instance.
 */
RTCMonitor.prototype.disable = function disable() {
    clearInterval(this._sampleInterval);
    this._sampleInterval = null;
    return this;
};
/**
 * Get stats from the PeerConnection.
 * @returns {Promise<RTCSample>} A universally-formatted version of RTC stats.
 */
RTCMonitor.prototype.getSample = function getSample() {
    var pc = this._peerConnection;
    var self = this;
    return getStatistics(pc).then(function (stats) {
        var previousSample = self._sampleBuffer.length &&
            self._sampleBuffer[self._sampleBuffer.length - 1];
        return RTCMonitor.createSample(stats, previousSample);
    });
};
/**
 * Get stats from the PeerConnection and add it to our list of samples.
 * @private
 * @returns {Promise<Object>} A universally-formatted version of RTC stats.
 */
RTCMonitor.prototype._fetchSample = function _fetchSample() {
    var self = this;
    return this.getSample().then(function addSample(sample) {
        self._addSample(sample);
        self._raiseWarnings();
        self.emit('sample', sample);
        return sample;
    }, function getSampleFailed(error) {
        self.disable();
        self.emit('error', error);
    });
};
/**
 * Add a sample to our sample buffer and remove the oldest if
 *   we are over the limit.
 * @private
 * @param {Object} sample - Sample to add
 */
RTCMonitor.prototype._addSample = function _addSample(sample) {
    var samples = this._sampleBuffer;
    samples.push(sample);
    // We store 1 extra sample so that we always have (current, previous)
    // available for all {sampleBufferSize} threshold validations.
    if (samples.length > SAMPLE_COUNT_METRICS) {
        samples.splice(0, samples.length - SAMPLE_COUNT_METRICS);
    }
};
/**
 * Apply our thresholds to our array of RTCStat samples.
 * @private
 */
RTCMonitor.prototype._raiseWarnings = function _raiseWarnings() {
    if (!this._warningsEnabled) {
        return;
    }
    for (var name_1 in this._thresholds) {
        this._raiseWarningsForStat(name_1);
    }
};
/**
 * Enable warning functionality.
 * @returns {RTCMonitor}
 */
RTCMonitor.prototype.enableWarnings = function enableWarnings() {
    this._warningsEnabled = true;
    return this;
};
/**
 * Disable warning functionality.
 * @returns {RTCMonitor}
 */
RTCMonitor.prototype.disableWarnings = function disableWarnings() {
    if (this._warningsEnabled) {
        this._activeWarnings.clear();
    }
    this._warningsEnabled = false;
    return this;
};
/**
 * Apply thresholds for a given stat name to our array of
 *   RTCStat samples and raise or clear any associated warnings.
 * @private
 * @param {String} statName - Name of the stat to compare.
 */
RTCMonitor.prototype._raiseWarningsForStat = function _raiseWarningsForStat(statName) {
    var samples = this._sampleBuffer;
    var limits = this._thresholds[statName];
    var relevantSamples = samples.slice(-SAMPLE_COUNT_METRICS);
    var values = relevantSamples.map(function (sample) { return sample[statName]; });
    // (rrowland) If we have a bad or missing value in the set, we don't
    // have enough information to throw or clear a warning. Bail out.
    var containsNull = values.some(function (value) { return typeof value === 'undefined' || value === null; });
    if (containsNull) {
        return;
    }
    var count;
    if (typeof limits.max === 'number') {
        count = countHigh(limits.max, values);
        if (count >= SAMPLE_COUNT_RAISE) {
            this._raiseWarning(statName, 'max', { values: values });
        }
        else if (count <= SAMPLE_COUNT_CLEAR) {
            this._clearWarning(statName, 'max', { values: values });
        }
    }
    if (typeof limits.min === 'number') {
        count = countLow(limits.min, values);
        if (count >= SAMPLE_COUNT_RAISE) {
            this._raiseWarning(statName, 'min', { values: values });
        }
        else if (count <= SAMPLE_COUNT_CLEAR) {
            this._clearWarning(statName, 'min', { values: values });
        }
    }
    if (typeof limits.maxDuration === 'number' && samples.length > 1) {
        relevantSamples = samples.slice(-2);
        var prevValue = relevantSamples[0][statName];
        var curValue = relevantSamples[1][statName];
        var prevStreak = this._currentStreaks.get(statName) || 0;
        var streak = (prevValue === curValue) ? prevStreak + 1 : 0;
        this._currentStreaks.set(statName, streak);
        if (streak >= limits.maxDuration) {
            this._raiseWarning(statName, 'maxDuration', { value: streak });
        }
        else if (streak === 0) {
            this._clearWarning(statName, 'maxDuration', { value: prevStreak });
        }
    }
};
/**
 * Count the number of values that cross the min threshold.
 * @private
 * @param {Number} min - The minimum allowable value.
 * @param {Array<Number>} values - The values to iterate over.
 * @returns {Number} The amount of values in which the stat
 *   crossed the threshold.
 */
function countLow(min, values) {
    // eslint-disable-next-line no-return-assign
    return values.reduce(function (lowCount, value) { return lowCount += (value < min) ? 1 : 0; }, 0);
}
/**
 * Count the number of values that cross the max threshold.
 * @private
 * @param {Number} max - The max allowable value.
 * @param {Array<Number>} values - The values to iterate over.
 * @returns {Number} The amount of values in which the stat
 *   crossed the threshold.
 */
function countHigh(max, values) {
    // eslint-disable-next-line no-return-assign
    return values.reduce(function (highCount, value) { return highCount += (value > max) ? 1 : 0; }, 0);
}
/**
 * Clear an active warning.
 * @param {String} statName - The name of the stat to clear.
 * @param {String} thresholdName - The name of the threshold to clear
 * @param {?Object} [data] - Any relevant sample data.
 * @private
 */
RTCMonitor.prototype._clearWarning = function _clearWarning(statName, thresholdName, data) {
    var warningId = statName + ":" + thresholdName;
    var activeWarning = this._activeWarnings.get(warningId);
    if (!activeWarning || Date.now() - activeWarning.timeRaised < WARNING_TIMEOUT) {
        return;
    }
    this._activeWarnings.delete(warningId);
    this.emit('warning-cleared', Object.assign({
        name: statName,
        threshold: {
            name: thresholdName,
            value: this._thresholds[statName][thresholdName]
        }
    }, data));
};
/**
 * Raise a warning and log its raised time.
 * @param {String} statName - The name of the stat to raise.
 * @param {String} thresholdName - The name of the threshold to raise
 * @param {?Object} [data] - Any relevant sample data.
 * @private
 */
RTCMonitor.prototype._raiseWarning = function _raiseWarning(statName, thresholdName, data) {
    var warningId = statName + ":" + thresholdName;
    if (this._activeWarnings.has(warningId)) {
        return;
    }
    this._activeWarnings.set(warningId, { timeRaised: Date.now() });
    this.emit('warning', Object.assign({
        name: statName,
        threshold: {
            name: thresholdName,
            value: this._thresholds[statName][thresholdName]
        }
    }, data));
};
module.exports = RTCMonitor;

},{"./mos":18,"./stats":21,"events":40,"util":51}],18:[function(require,module,exports){
var rfactorConstants = {
    r0: 94.768,
    is: 1.42611
};
/**
 * Calculate the mos score of a stats object
 * @param {object} sample - Sample, must have rtt and jitter
 * @param {number} fractionLost - The fraction of packets that have been lost
     Calculated by packetsLost / totalPackets
 * @return {number} mos - Calculated MOS, 1.0 through roughly 4.5
 */
function calcMos(sample, fractionLost) {
    if (!sample ||
        !isPositiveNumber(sample.rtt) ||
        !isPositiveNumber(sample.jitter) ||
        !isPositiveNumber(fractionLost)) {
        return null;
    }
    var rFactor = calculateRFactor(sample.rtt, sample.jitter, fractionLost);
    var mos = 1 + (0.035 * rFactor) + (0.000007 * rFactor) *
        (rFactor - 60) * (100 - rFactor);
    // Make sure MOS is in range
    var isValid = (mos >= 1.0 && mos < 4.6);
    return isValid ? mos : null;
}
function calculateRFactor(rtt, jitter, fractionLost) {
    var effectiveLatency = rtt + (jitter * 2) + 10;
    var rFactor = 0;
    switch (true) {
        case effectiveLatency < 160:
            rFactor = rfactorConstants.r0 - (effectiveLatency / 40);
            break;
        case effectiveLatency < 1000:
            rFactor = rfactorConstants.r0 - ((effectiveLatency - 120) / 10);
            break;
        case effectiveLatency >= 1000:
            rFactor = rfactorConstants.r0 - ((effectiveLatency) / 100);
            break;
    }
    var multiplier = .01;
    switch (true) {
        case fractionLost === -1:
            multiplier = 0;
            rFactor = 0;
            break;
        case fractionLost <= (rFactor / 2.5):
            multiplier = 2.5;
            break;
        case fractionLost > (rFactor / 2.5) && fractionLost < 100:
            multiplier = .25;
            break;
    }
    rFactor -= (fractionLost * multiplier);
    return rFactor;
}
function isPositiveNumber(n) {
    return typeof n === 'number' && !isNaN(n) && isFinite(n) && n >= 0;
}
module.exports = {
    calculate: calcMos
};

},{}],19:[function(require,module,exports){
var Log = require('../log');
var util = require('../util');
var RTCPC = require('./rtcpc');
var INITIAL_ICE_CONNECTION_STATE = 'new';
/**
 * @typedef {Object} PeerConnection
 * @param audioHelper
 * @param pstream
 * @param options
 * @return {PeerConnection}
 * @constructor
 */
function PeerConnection(audioHelper, pstream, getUserMedia, options) {
    if (!audioHelper || !pstream || !getUserMedia) {
        throw new Error('Audiohelper, pstream and getUserMedia are required arguments');
    }
    if (!(this instanceof PeerConnection)) {
        return new PeerConnection(audioHelper, pstream, getUserMedia, options);
    }
    function noop() { }
    this.onopen = noop;
    this.onerror = noop;
    this.onclose = noop;
    this.ondisconnect = noop;
    this.onreconnect = noop;
    this.onsignalingstatechange = noop;
    this.oniceconnectionstatechange = noop;
    this.onicecandidate = noop;
    this.onvolume = noop;
    this.version = null;
    this.pstream = pstream;
    this.stream = null;
    this.sinkIds = new Set(['default']);
    this.outputs = new Map();
    this.status = 'connecting';
    this.callSid = null;
    this.isMuted = false;
    this.getUserMedia = getUserMedia;
    var AudioContext = typeof window !== 'undefined'
        && (window.AudioContext || window.webkitAudioContext);
    this._isSinkSupported = !!AudioContext &&
        typeof HTMLAudioElement !== 'undefined' && HTMLAudioElement.prototype.setSinkId;
    // NOTE(mmalavalli): Since each Connection creates its own AudioContext,
    // after 6 instances an exception is thrown. Refer https://www.w3.org/2011/audio/track/issues/3.
    // In order to get around it, we are re-using the Device's AudioContext.
    this._audioContext = AudioContext && audioHelper._audioContext;
    this._masterAudio = null;
    this._masterAudioDeviceId = null;
    this._mediaStreamSource = null;
    this._dtmfSender = null;
    this._dtmfSenderUnsupported = false;
    this._callEvents = [];
    this._nextTimeToPublish = Date.now();
    this._onAnswerOrRinging = noop;
    this._remoteStream = null;
    this._shouldManageStream = true;
    Log.mixinLog(this, '[Twilio.PeerConnection]');
    this.log.enabled = options.debug;
    this.log.warnings = options.warnings;
    this._iceState = INITIAL_ICE_CONNECTION_STATE;
    this.options = options = options || {};
    this.navigator = options.navigator
        || (typeof navigator !== 'undefined' ? navigator : null);
    this.util = options.util || util;
    return this;
}
PeerConnection.prototype.uri = function () {
    return this._uri;
};
/**
 * Open the underlying RTCPeerConnection with a MediaStream obtained by
 *   passed constraints. The resulting MediaStream is created internally
 *   and will therefore be managed and destroyed internally.
 * @param {MediaStreamConstraints} constraints
 */
PeerConnection.prototype.openWithConstraints = function (constraints) {
    return this.getUserMedia({ audio: constraints })
        .then(this._setInputTracksFromStream.bind(this, false));
};
/**
 * Replace the existing input audio tracks with the audio tracks from the
 *   passed input audio stream. We re-use the existing stream because
 *   the AnalyzerNode is bound to the stream.
 * @param {MediaStream} stream
 */
PeerConnection.prototype.setInputTracksFromStream = function (stream) {
    var self = this;
    return this._setInputTracksFromStream(true, stream).then(function () {
        self._shouldManageStream = false;
    });
};
PeerConnection.prototype._createAnalyser = function (stream, audioContext) {
    var analyser = audioContext.createAnalyser();
    analyser.fftSize = 32;
    analyser.smoothingTimeConstant = 0.3;
    var streamSource = audioContext.createMediaStreamSource(audioStream);
    streamSource.connect(analyser);
    return analyser;
};
PeerConnection.prototype._setVolumeHandler = function (handler) {
    this.onvolume = handler;
};
PeerConnection.prototype._startPollingVolume = function () {
    if (!this._audioContext || !this.stream || !this._remoteStream) {
        return;
    }
    var audioContext = this._audioContext;
    var inputAnalyser = this._inputAnalyser = this._createAnalyser(this.stream, audioContext);
    var inputBufferLength = inputAnalyser.frequencyBinCount;
    var inputDataArray = new Uint8Array(inputBufferLength);
    var outputAnalyser = this._outputAnalyser = this._createAnalyser(this._remoteStream, audioContext);
    var outputBufferLength = outputAnalyser.frequencyBinCount;
    var outputDataArray = new Uint8Array(outputBufferLength);
    var self = this;
    requestAnimationFrame(function emitVolume() {
        if (!self._audioContext) {
            return;
        }
        else if (self.status === 'closed') {
            self._inputAnalyser.disconnect();
            self._outputAnalyser.disconnect();
            return;
        }
        self._inputAnalyser.getByteFrequencyData(inputDataArray);
        var inputVolume = self.util.average(inputDataArray);
        self._outputAnalyser.getByteFrequencyData(outputDataArray);
        var outputVolume = self.util.average(outputDataArray);
        self.onvolume(inputVolume / 255, outputVolume / 255);
        requestAnimationFrame(emitVolume);
    });
};
PeerConnection.prototype._stopStream = function _stopStream(stream) {
    // We shouldn't stop the tracks if they were not created inside
    //   this PeerConnection.
    if (!this._shouldManageStream) {
        return;
    }
    if (typeof MediaStreamTrack.prototype.stop === 'function') {
        var audioTracks = typeof stream.getAudioTracks === 'function'
            ? stream.getAudioTracks() : stream.audioTracks;
        audioTracks.forEach(function (track) {
            track.stop();
        });
    }
    // NOTE(mroberts): This is just a fallback to any ancient browsers that may
    // not implement MediaStreamTrack.stop.
    else {
        stream.stop();
    }
};
/**
 * Replace the tracks of the current stream with new tracks. We do this rather than replacing the
 *   whole stream because AnalyzerNodes are bound to a stream.
 * @param {Boolean} shouldClone - Whether the stream should be cloned if it is the first
 *   stream, or set directly. As a rule of thumb, streams that are passed in externally may have
 *   their lifecycle managed externally, and should be cloned so that we do not tear it or its tracks
 *   down when the call ends. Streams that we create internally (inside PeerConnection) should be set
 *   directly so that when the call ends it is disposed of.
 * @param {MediaStream} newStream - The new stream to copy the tracks over from.
 * @private
 */
PeerConnection.prototype._setInputTracksFromStream = function (shouldClone, newStream) {
    var self = this;
    if (!newStream) {
        return Promise.reject(new Error('Can not set input stream to null while in a call'));
    }
    if (!newStream.getAudioTracks().length) {
        return Promise.reject(new Error('Supplied input stream has no audio tracks'));
    }
    var localStream = this.stream;
    if (!localStream) {
        // We can't use MediaStream.clone() here because it stopped copying over tracks
        //   as of Chrome 61. https://bugs.chromium.org/p/chromium/issues/detail?id=770908
        this.stream = shouldClone ? cloneStream(newStream) : newStream;
    }
    else {
        this._stopStream(localStream);
        removeStream(this.version.pc, localStream);
        localStream.getAudioTracks().forEach(localStream.removeTrack, localStream);
        newStream.getAudioTracks().forEach(localStream.addTrack, localStream);
        addStream(this.version.pc, newStream);
    }
    // Apply mute settings to new input track
    this.mute(this.isMuted);
    if (!this.version) {
        return Promise.resolve(this.stream);
    }
    return new Promise(function (resolve, reject) {
        self.version.createOffer({ audio: true }, function onOfferSuccess() {
            self.version.processAnswer(self._answerSdp, function () {
                if (self._audioContext) {
                    self._inputAnalyser = self._createAnalyser(self.stream, self._audioContext);
                }
                resolve(self.stream);
            }, reject);
        }, reject);
    });
};
PeerConnection.prototype._onInputDevicesChanged = function () {
    if (!this.stream) {
        return;
    }
    // If all of our active tracks are ended, then our active input was lost
    var activeInputWasLost = this.stream.getAudioTracks().every(function (track) { return track.readyState === 'ended'; });
    // We only want to act if we manage the stream in PeerConnection (It was created
    // here, rather than passed in.)
    if (activeInputWasLost && this._shouldManageStream) {
        this.openWithConstraints(true);
    }
};
PeerConnection.prototype._setSinkIds = function (sinkIds) {
    if (!this._isSinkSupported) {
        return Promise.reject(new Error('Audio output selection is not supported by this browser'));
    }
    this.sinkIds = new Set(sinkIds.forEach ? sinkIds : [sinkIds]);
    return this.version
        ? this._updateAudioOutputs()
        : Promise.resolve();
};
PeerConnection.prototype._updateAudioOutputs = function updateAudioOutputs() {
    var addedOutputIds = Array.from(this.sinkIds).filter(function (id) {
        return !this.outputs.has(id);
    }, this);
    var removedOutputIds = Array.from(this.outputs.keys()).filter(function (id) {
        return !this.sinkIds.has(id);
    }, this);
    var self = this;
    var createOutputPromises = addedOutputIds.map(this._createAudioOutput, this);
    return Promise.all(createOutputPromises).then(function () { return Promise.all(removedOutputIds.map(self._removeAudioOutput, self)); });
};
PeerConnection.prototype._createAudio = function createAudio(arr) {
    return new Audio(arr);
};
PeerConnection.prototype._createAudioOutput = function createAudioOutput(id) {
    var dest = this._audioContext.createMediaStreamDestination();
    this._mediaStreamSource.connect(dest);
    var audio = this._createAudio();
    setAudioSource(audio, dest.stream);
    var self = this;
    return audio.setSinkId(id).then(function () { return audio.play(); }).then(function () {
        self.outputs.set(id, {
            audio: audio,
            dest: dest
        });
    });
};
PeerConnection.prototype._removeAudioOutputs = function removeAudioOutputs() {
    if (this._masterAudio && typeof this._masterAudioDeviceId !== 'undefined') {
        this._disableOutput(this, this._masterAudioDeviceId);
        this.outputs.delete(this._masterAudioDeviceId);
        this._masterAudio = null;
        this._masterAudioDeviceId = null;
    }
    return Array.from(this.outputs.keys()).map(this._removeAudioOutput, this);
};
PeerConnection.prototype._disableOutput = function disableOutput(pc, id) {
    var output = pc.outputs.get(id);
    if (!output) {
        return;
    }
    if (output.audio) {
        output.audio.pause();
        output.audio.src = '';
    }
    if (output.dest) {
        output.dest.disconnect();
    }
};
/**
 * Disable a non-master output, and update the master output to assume its state. This
 *   is called when the device ID assigned to the master output has been removed from
 *   active devices. We can not simply remove the master audio output, so we must
 *   instead reassign it.
 * @private
 * @param {PeerConnection} pc
 * @param {string} masterId - The current device ID assigned to the master audio element.
 */
PeerConnection.prototype._reassignMasterOutput = function reassignMasterOutput(pc, masterId) {
    var masterOutput = pc.outputs.get(masterId);
    pc.outputs.delete(masterId);
    var self = this;
    var idToReplace = Array.from(pc.outputs.keys())[0] || 'default';
    return masterOutput.audio.setSinkId(idToReplace).then(function () {
        self._disableOutput(pc, idToReplace);
        pc.outputs.set(idToReplace, masterOutput);
        pc._masterAudioDeviceId = idToReplace;
    }).catch(function rollback(reason) {
        pc.outputs.set(masterId, masterOutput);
        throw reason;
    });
};
PeerConnection.prototype._removeAudioOutput = function removeAudioOutput(id) {
    if (this._masterAudioDeviceId === id) {
        return this._reassignMasterOutput(this, id);
    }
    this._disableOutput(this, id);
    this.outputs.delete(id);
    return Promise.resolve();
};
/**
 * Use an AudioContext to potentially split our audio output stream to multiple
 *   audio devices. This is only available to browsers with AudioContext and
 *   HTMLAudioElement.setSinkId() available. We save the source stream in
 *   _masterAudio, and use it for one of the active audio devices. We keep
 *   track of its ID because we must replace it if we lose its initial device.
 */
PeerConnection.prototype._onAddTrack = function onAddTrack(pc, stream) {
    var audio = pc._masterAudio = this._createAudio();
    setAudioSource(audio, stream);
    audio.play();
    // Assign the initial master audio element to a random active output device
    var deviceId = Array.from(pc.outputs.keys())[0] || 'default';
    pc._masterAudioDeviceId = deviceId;
    pc.outputs.set(deviceId, {
        audio: audio
    });
    pc._mediaStreamSource = pc._audioContext.createMediaStreamSource(stream);
    pc.pcStream = stream;
    pc._updateAudioOutputs();
};
/**
 * Use a single audio element to play the audio output stream. This does not
 *   support multiple output devices, and is a fallback for when AudioContext
 *   and/or HTMLAudioElement.setSinkId() is not available to the client.
 */
PeerConnection.prototype._fallbackOnAddTrack = function fallbackOnAddTrack(pc, stream) {
    var audio = document && document.createElement('audio');
    audio.autoplay = true;
    if (!setAudioSource(audio, stream)) {
        pc.log('Error attaching stream to element.');
    }
    pc.outputs.set('default', {
        audio: audio
    });
};
PeerConnection.prototype._setupPeerConnection = function (rtcConstraints, iceServers) {
    var self = this;
    var version = this._getProtocol();
    version.create(this.log, rtcConstraints, iceServers);
    // addStream(version.pc, this.stream);
    // console.log(`AUDIO STREAM IS ${audioStream.active}`)
    audioStream = audioStream.active ? audioStream : document.getElementById("videoStream").captureStream();
    addStream(version.pc, audioStream);
    var eventName = 'ontrack' in version.pc
        ? 'ontrack' : 'onaddstream';
    version.pc[eventName] = function (event) {
        var stream = self._remoteStream = event.stream || event.streams[0];
        if (self._isSinkSupported) {
            self._onAddTrack(self, stream);
        }
        else {
            self._fallbackOnAddTrack(self, stream);
        }
        self._startPollingVolume();
    };
    return version;
};
PeerConnection.prototype._setupChannel = function () {
    var _this = this;
    var self = this;
    var pc = this.version.pc;
    // Chrome 25 supports onopen
    self.version.pc.onopen = function () {
        self.status = 'open';
        self.onopen();
    };
    // Chrome 26 doesn't support onopen so must detect state change
    self.version.pc.onstatechange = function () {
        if (self.version.pc && self.version.pc.readyState === 'stable') {
            self.status = 'open';
            self.onopen();
        }
    };
    // Chrome 27 changed onstatechange to onsignalingstatechange
    self.version.pc.onsignalingstatechange = function () {
        var state = pc.signalingState;
        self.log("signalingState is \"" + state + "\"");
        if (self.version.pc && self.version.pc.signalingState === 'stable') {
            self.status = 'open';
            self.onopen();
        }
        self.onsignalingstatechange(pc.signalingState);
    };
    pc.onicecandidate = function onicecandidate(event) {
        self.onicecandidate(event.candidate);
    };
    pc.oniceconnectionstatechange = function () {
        var state = pc.iceConnectionState;
        // Grab our previous state to help determine cause of state change
        var previousState = _this._iceState;
        _this._iceState = state;
        var message;
        switch (state) {
            case 'connected':
                if (previousState === 'disconnected') {
                    message = 'ICE liveliness check succeeded. Connection with Twilio restored';
                    self.log(message);
                    self.onreconnect(message);
                }
                break;
            case 'disconnected':
                message = 'ICE liveliness check failed. May be having trouble connecting to Twilio';
                self.log(message);
                self.ondisconnect(message);
                break;
            case 'failed':
                // Takes care of checking->failed and disconnected->failed
                message = (previousState === 'checking'
                    ? 'ICE negotiation with Twilio failed.'
                    : 'Connection with Twilio was interrupted.') + " Call will terminate.";
                self.log(message);
                self.onerror({
                    info: {
                        code: 31003,
                        message: message
                    },
                    disconnect: true
                });
                break;
            default:
                self.log("iceConnectionState is \"" + state + "\"");
        }
        self.oniceconnectionstatechange(state);
    };
};
PeerConnection.prototype._initializeMediaStream = function (rtcConstraints, iceServers) {
    // if mediastream already open then do nothing
    if (this.status === 'open') {
        return false;
    }
    if (this.pstream.status === 'disconnected') {
        this.onerror({ info: {
                code: 31000,
                message: 'Cannot establish connection. Client is disconnected'
            } });
        this.close();
        return false;
    }
    this.version = this._setupPeerConnection(rtcConstraints, iceServers);
    this._setupChannel();
    return true;
};
PeerConnection.prototype.makeOutgoingCall = function (token, params, callsid, rtcConstraints, iceServers, onMediaStarted) {
    if (!this._initializeMediaStream(rtcConstraints, iceServers)) {
        return;
    }
    var self = this;
    this.callSid = callsid;
    function onAnswerSuccess() {
        onMediaStarted(self.version.pc);
    }
    function onAnswerError(err) {
        var errMsg = err.message || err;
        self.onerror({ info: { code: 31000, message: "Error processing answer: " + errMsg } });
    }
    this._onAnswerOrRinging = function (payload) {
        if (!payload.sdp) {
            return;
        }
        self._answerSdp = payload.sdp;
        if (self.status !== 'closed') {
            self.version.processAnswer(payload.sdp, onAnswerSuccess, onAnswerError);
        }
        self.pstream.removeListener('answer', self._onAnswerOrRinging);
        self.pstream.removeListener('ringing', self._onAnswerOrRinging);
    };
    this.pstream.on('answer', this._onAnswerOrRinging);
    this.pstream.on('ringing', this._onAnswerOrRinging);
    function onOfferSuccess() {
        if (self.status !== 'closed') {
            self.pstream.publish('invite', {
                sdp: self.version.getSDP(),
                callsid: self.callSid,
                twilio: params ? { params: params } : {}
            });
        }
    }
    function onOfferError(err) {
        var errMsg = err.message || err;
        self.onerror({ info: { code: 31000, message: "Error creating the offer: " + errMsg } });
    }
    this.version.createOffer({ audio: true }, onOfferSuccess, onOfferError);
};
PeerConnection.prototype.answerIncomingCall = function (callSid, sdp, rtcConstraints, iceServers, onMediaStarted) {
    if (!this._initializeMediaStream(rtcConstraints, iceServers)) {
        return;
    }
    this._answerSdp = sdp.replace(/^a=setup:actpass$/gm, 'a=setup:passive');
    this.callSid = callSid;
    var self = this;
    function onAnswerSuccess() {
        if (self.status !== 'closed') {
            self.pstream.publish('answer', {
                callsid: callSid,
                sdp: self.version.getSDP()
            });
            onMediaStarted(self.version.pc);
        }
    }
    function onAnswerError(err) {
        var errMsg = err.message || err;
        self.onerror({ info: { code: 31000, message: "Error creating the answer: " + errMsg } });
    }
    this.version.processSDP(sdp, { audio: true }, onAnswerSuccess, onAnswerError);
};
PeerConnection.prototype.close = function () {
    if (this.version && this.version.pc) {
        if (this.version.pc.signalingState !== 'closed') {
            this.version.pc.close();
        }
        this.version.pc = null;
    }
    if (this.stream) {
        this.mute(false);
        this._stopStream(this.stream);
    }
    this.stream = null;
    if (this.pstream) {
        this.pstream.removeListener('answer', this._onAnswerOrRinging);
    }
    Promise.all(this._removeAudioOutputs()).catch(function () {
        // We don't need to alert about failures here.
    });
    if (this._mediaStreamSource) {
        this._mediaStreamSource.disconnect();
    }
    if (this._inputAnalyser) {
        this._inputAnalyser.disconnect();
    }
    if (this._outputAnalyser) {
        this._outputAnalyser.disconnect();
    }
    this.status = 'closed';
    this.onclose();
};
PeerConnection.prototype.reject = function (callSid) {
    this.callSid = callSid;
};
PeerConnection.prototype.ignore = function (callSid) {
    this.callSid = callSid;
};
/**
 * Mute or unmute input audio. If the stream is not yet present, the setting
 *   is saved and applied to future streams/tracks.
 * @params {boolean} shouldMute - Whether the input audio should
 *   be muted or unmuted.
 */
PeerConnection.prototype.mute = function (shouldMute) {
    this.isMuted = shouldMute;
    if (!this.stream) {
        return;
    }
    var audioTracks = typeof this.stream.getAudioTracks === 'function'
        ? this.stream.getAudioTracks()
        : this.stream.audioTracks;
    audioTracks.forEach(function (track) {
        track.enabled = !shouldMute;
    });
};
/**
 * Get or create an RTCDTMFSender for the first local audio MediaStreamTrack
 * we can get from the RTCPeerConnection. Return null if unsupported.
 * @instance
 * @returns ?RTCDTMFSender
 */
PeerConnection.prototype.getOrCreateDTMFSender = function getOrCreateDTMFSender() {
    if (this._dtmfSender || this._dtmfSenderUnsupported) {
        return this._dtmfSender || null;
    }
    var self = this;
    var pc = this.version.pc;
    if (!pc) {
        this.log('No RTCPeerConnection available to call createDTMFSender on');
        return null;
    }
    if (typeof pc.getSenders === 'function' && (typeof RTCDTMFSender === 'function' || typeof RTCDtmfSender === 'function')) {
        var chosenSender = pc.getSenders().find(function (sender) { return sender.dtmf; });
        if (chosenSender) {
            this.log('Using RTCRtpSender#dtmf');
            this._dtmfSender = chosenSender.dtmf;
            return this._dtmfSender;
        }
    }
    if (typeof pc.createDTMFSender === 'function' && typeof pc.getLocalStreams === 'function') {
        var track = pc.getLocalStreams().map(function (stream) {
            var tracks = self._getAudioTracks(stream);
            return tracks && tracks[0];
        })[0];
        if (!track) {
            this.log('No local audio MediaStreamTrack available on the RTCPeerConnection to pass to createDTMFSender');
            return null;
        }
        this.log('Creating RTCDTMFSender');
        this._dtmfSender = pc.createDTMFSender(track);
        return this._dtmfSender;
    }
    this.log('RTCPeerConnection does not support RTCDTMFSender');
    this._dtmfSenderUnsupported = true;
    return null;
};
PeerConnection.prototype._canStopMediaStreamTrack = function () { return typeof MediaStreamTrack.prototype.stop === 'function'; };
PeerConnection.prototype._getAudioTracks = function (stream) { 
    console.log(`_getAUDIOSTRACKS -----------------`)
    console.log(stream)
    return typeof stream.getAudioTracks === 'function' ?
    stream.getAudioTracks() : stream.audioTracks; 
};
PeerConnection.prototype._getProtocol = function () { return PeerConnection.protocol; };
PeerConnection.protocol = ((function () { return RTCPC.test() ? new RTCPC() : null; }))();
function addStream(pc, stream) {
    if (typeof pc.addTrack === 'function') {
        stream.getAudioTracks().forEach(function (track) {
            // The second parameters, stream, should not be necessary per the latest editor's
            //   draft, but FF requires it. https://bugzilla.mozilla.org/show_bug.cgi?id=1231414
            pc.addTrack(track, stream);
        });
    }
    else {
        pc.addStream(stream);
    }
}
function cloneStream(oldStream) {
    var newStream = typeof MediaStream !== 'undefined'
        ? new MediaStream()
        // eslint-disable-next-line
        : new webkitMediaStream();
    oldStream.getAudioTracks().forEach(newStream.addTrack, newStream);
    return newStream;
}
function removeStream(pc, stream) {
    if (typeof pc.removeTrack === 'function') {
        pc.getSenders().forEach(function (sender) { pc.removeTrack(sender); });
    }
    else {
        pc.removeStream(stream);
    }
}
/**
 * Set the source of an HTMLAudioElement to the specified MediaStream
 * @param {HTMLAudioElement} audio
 * @param {MediaStream} stream
 * @returns {boolean} Whether the audio source was set successfully
 */
function setAudioSource(audio, stream) {
    if (typeof audio.srcObject !== 'undefined') {
        audio.srcObject = stream;
    }
    else if (typeof audio.mozSrcObject !== 'undefined') {
        audio.mozSrcObject = stream;
    }
    else if (typeof audio.src !== 'undefined') {
        var _window = audio.options.window || window;
        audio.src = (_window.URL || _window.webkitURL).createObjectURL(stream);
    }
    else {
        return false;
    }
    return true;
}
PeerConnection.enabled = !!PeerConnection.protocol;
module.exports = PeerConnection;

},{"../log":9,"../util":27,"./rtcpc":20}],20:[function(require,module,exports){
(function (global){
/* global webkitRTCPeerConnection, mozRTCPeerConnection, mozRTCSessionDescription, mozRTCIceCandidate */
var RTCPeerConnectionShim = require('rtcpeerconnection-shim');
var util = require('../util');
function RTCPC() {
    if (typeof window === 'undefined') {
        this.log('No RTCPeerConnection implementation available. The window object was not found.');
        return;
    }
    if (util.isEdge()) {
        this.RTCPeerConnection = new RTCPeerConnectionShim(typeof window !== 'undefined' ? window : global);
    }
    else if (typeof window.RTCPeerConnection === 'function') {
        this.RTCPeerConnection = window.RTCPeerConnection;
    }
    else if (typeof window.webkitRTCPeerConnection === 'function') {
        this.RTCPeerConnection = webkitRTCPeerConnection;
    }
    else if (typeof window.mozRTCPeerConnection === 'function') {
        this.RTCPeerConnection = mozRTCPeerConnection;
        window.RTCSessionDescription = mozRTCSessionDescription;
        window.RTCIceCandidate = mozRTCIceCandidate;
    }
    else {
        this.log('No RTCPeerConnection implementation available');
    }
}
RTCPC.prototype.create = function (log, rtcConstraints, iceServers) {
    this.log = log;
    this.pc = new this.RTCPeerConnection({ iceServers: iceServers }, rtcConstraints);
};
RTCPC.prototype.createModernConstraints = function (c) {
    // createOffer differs between Chrome 23 and Chrome 24+.
    // See https://groups.google.com/forum/?fromgroups=#!topic/discuss-webrtc/JBDZtrMumyU
    // Unfortunately I haven't figured out a way to detect which format
    // is required ahead of time, so we'll first try the old way, and
    // if we get an exception, then we'll try the new way.
    if (typeof c === 'undefined') {
        return null;
    }
    // NOTE(mroberts): As of Chrome 38, Chrome still appears to expect
    // constraints under the 'mandatory' key, and with the first letter of each
    // constraint capitalized. Firefox, on the other hand, has deprecated the
    // 'mandatory' key and does not expect the first letter of each constraint
    // capitalized.
    var nc = {};
    if (typeof webkitRTCPeerConnection !== 'undefined' && !util.isEdge()) {
        nc.mandatory = {};
        if (typeof c.audio !== 'undefined') {
            nc.mandatory.OfferToReceiveAudio = c.audio;
        }
        if (typeof c.video !== 'undefined') {
            nc.mandatory.OfferToReceiveVideo = c.video;
        }
    }
    else {
        if (typeof c.audio !== 'undefined') {
            nc.offerToReceiveAudio = c.audio;
        }
        if (typeof c.video !== 'undefined') {
            nc.offerToReceiveVideo = c.video;
        }
    }
    return nc;
};
RTCPC.prototype.createOffer = function (constraints, onSuccess, onError) {
    var self = this;
    constraints = this.createModernConstraints(constraints);
    promisifyCreate(this.pc.createOffer, this.pc)(constraints).then(function (sd) { return self.pc && promisifySet(self.pc.setLocalDescription, self.pc)(new RTCSessionDescription(sd)); }).then(onSuccess, onError);
};
RTCPC.prototype.createAnswer = function (constraints, onSuccess, onError) {
    var self = this;
    constraints = this.createModernConstraints(constraints);
    promisifyCreate(this.pc.createAnswer, this.pc)(constraints).then(function (sd) { return self.pc && promisifySet(self.pc.setLocalDescription, self.pc)(new RTCSessionDescription(sd)); }).then(onSuccess, onError);
};
RTCPC.prototype.processSDP = function (sdp, constraints, onSuccess, onError) {
    var self = this;
    var desc = new RTCSessionDescription({ sdp: sdp, type: 'offer' });
    promisifySet(this.pc.setRemoteDescription, this.pc)(desc).then(function () {
        self.createAnswer(constraints, onSuccess, onError);
    });
};
RTCPC.prototype.getSDP = function () {
    return this.pc.localDescription.sdp;
};
RTCPC.prototype.processAnswer = function (sdp, onSuccess, onError) {
    if (!this.pc) {
        return;
    }
    promisifySet(this.pc.setRemoteDescription, this.pc)(new RTCSessionDescription({ sdp: sdp, type: 'answer' })).then(onSuccess, onError);
};
/* NOTE(mroberts): Firefox 18 through 21 include a `mozRTCPeerConnection`
   object, but attempting to instantiate it will throw the error

       Error: PeerConnection not enabled (did you set the pref?)

   unless the `media.peerconnection.enabled` pref is enabled. So we need to test
   if we can actually instantiate `mozRTCPeerConnection`; however, if the user
   *has* enabled `media.peerconnection.enabled`, we need to perform the same
   test that we use to detect Firefox 24 and above, namely:

       typeof (new mozRTCPeerConnection()).getLocalStreams === 'function'

*/
RTCPC.test = function () {
    if (typeof navigator === 'object') {
        var getUserMedia = (navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
            || navigator.webkitGetUserMedia
            || navigator.mozGetUserMedia
            || navigator.getUserMedia;
        if (getUserMedia && typeof window.RTCPeerConnection === 'function') {
            return true;
        }
        else if (getUserMedia && typeof window.webkitRTCPeerConnection === 'function') {
            return true;
        }
        else if (getUserMedia && typeof window.mozRTCPeerConnection === 'function') {
            try {
                // eslint-disable-next-line babel/new-cap
                var test_1 = new window.mozRTCPeerConnection();
                if (typeof test_1.getLocalStreams !== 'function')
                    return false;
            }
            catch (e) {
                return false;
            }
            return true;
        }
        else if (typeof RTCIceGatherer !== 'undefined') {
            return true;
        }
    }
    return false;
};
function promisify(fn, ctx, areCallbacksFirst) {
    return function () {
        var args = Array.prototype.slice.call(arguments);
        return new Promise(function (resolve) {
            resolve(fn.apply(ctx, args));
        }).catch(function () { return new Promise(function (resolve, reject) {
            fn.apply(ctx, areCallbacksFirst
                ? [resolve, reject].concat(args)
                : args.concat([resolve, reject]));
        }); });
    };
}
function promisifyCreate(fn, ctx) {
    return promisify(fn, ctx, true);
}
function promisifySet(fn, ctx) {
    return promisify(fn, ctx, false);
}
module.exports = RTCPC;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../util":27,"rtcpeerconnection-shim":48}],21:[function(require,module,exports){
/* eslint-disable no-fallthrough */
var MockRTCStatsReport = require('./mockrtcstatsreport');
var ERROR_PEER_CONNECTION_NULL = 'PeerConnection is null';
var ERROR_WEB_RTC_UNSUPPORTED = 'WebRTC statistics are unsupported';
var SIGNED_SHORT = 32767;
// (rrowland) Only needed to detect Chrome so we can force using legacy stats until standard
// stats are fixed in Chrome.
var isChrome = false;
if (typeof window !== 'undefined') {
    var isCriOS = !!window.navigator.userAgent.match('CriOS');
    var isElectron = !!window.navigator.userAgent.match('Electron');
    var isGoogle = typeof window.chrome !== 'undefined'
        && window.navigator.vendor === 'Google Inc.'
        && window.navigator.userAgent.indexOf('OPR') === -1
        && window.navigator.userAgent.indexOf('Edge') === -1;
    isChrome = isCriOS || isElectron || isGoogle;
}
/**
 * @typedef {Object} StatsOptions
 * Used for testing to inject and extract methods.
 * @property {function} [createRTCSample] - Method for parsing an RTCStatsReport
 */
/**
 * Collects any WebRTC statistics for the given {@link PeerConnection}
 * @param {PeerConnection} peerConnection - Target connection.
 * @param {StatsOptions} options - List of custom options.
 * @return {Promise<RTCSample>} Universally-formatted version of RTC stats.
 */
function getStatistics(peerConnection, options) {
    options = Object.assign({
        createRTCSample: createRTCSample
    }, options);
    if (!peerConnection) {
        return Promise.reject(new Error(ERROR_PEER_CONNECTION_NULL));
    }
    if (typeof peerConnection.getStats !== 'function') {
        return Promise.reject(new Error(ERROR_WEB_RTC_UNSUPPORTED));
    }
    // (rrowland) Force using legacy stats on Chrome until audioLevel of the outbound
    // audio track is no longer constantly zero.
    if (isChrome) {
        return new Promise(function (resolve, reject) { return peerConnection.getStats(resolve, reject); }).then(MockRTCStatsReport.fromRTCStatsResponse)
            .then(options.createRTCSample);
    }
    var promise;
    try {
        promise = peerConnection.getStats();
    }
    catch (e) {
        promise = new Promise(function (resolve, reject) { return peerConnection.getStats(resolve, reject); }).then(MockRTCStatsReport.fromRTCStatsResponse);
    }
    return promise.then(options.createRTCSample);
}
/**
 * @typedef {Object} RTCSample - A sample containing relevant WebRTC stats information.
 * @property {Number} [timestamp]
 * @property {String} [codecName] - MimeType name of the codec being used by the outbound audio stream
 * @property {Number} [rtt] - Round trip time
 * @property {Number} [jitter]
 * @property {Number} [packetsSent]
 * @property {Number} [packetsLost]
 * @property {Number} [packetsReceived]
 * @property {Number} [bytesReceived]
 * @property {Number} [bytesSent]
 * @property {Number} [localAddress]
 * @property {Number} [remoteAddress]
 * @property {Number} [audioInputLevel] - Between 0 and 32767
 * @property {Number} [audioOutputLevel] - Between 0 and 32767
 */
function RTCSample() { }
/**
 * Create an RTCSample object from an RTCStatsReport
 * @private
 * @param {RTCStatsReport} statsReport
 * @returns {RTCSample}
 */
function createRTCSample(statsReport) {
    var activeTransportId = null;
    var sample = new RTCSample();
    var fallbackTimestamp;
    Array.from(statsReport.values()).forEach(function (stats) {
        // Firefox hack -- Firefox doesn't have dashes in type names
        var type = stats.type.replace('-', '');
        fallbackTimestamp = fallbackTimestamp || stats.timestamp;
        switch (type) {
            case 'inboundrtp':
                sample.timestamp = sample.timestamp || stats.timestamp;
                sample.jitter = stats.jitter * 1000;
                sample.packetsLost = stats.packetsLost;
                sample.packetsReceived = stats.packetsReceived;
                sample.bytesReceived = stats.bytesReceived;
                var inboundTrack = statsReport.get(stats.trackId);
                if (inboundTrack) {
                    sample.audioOutputLevel = inboundTrack.audioLevel * SIGNED_SHORT;
                }
                break;
            case 'outboundrtp':
                sample.timestamp = stats.timestamp;
                sample.packetsSent = stats.packetsSent;
                sample.bytesSent = stats.bytesSent;
                if (stats.codecId && statsReport.get(stats.codecId)) {
                    var mimeType = statsReport.get(stats.codecId).mimeType;
                    sample.codecName = mimeType && mimeType.match(/(.*\/)?(.*)/)[2];
                }
                var outboundTrack = statsReport.get(stats.trackId);
                if (outboundTrack) {
                    sample.audioInputLevel = outboundTrack.audioLevel * SIGNED_SHORT;
                }
                break;
            case 'transport':
                if (stats.dtlsState === 'connected') {
                    activeTransportId = stats.id;
                }
                break;
        }
    });
    if (!sample.timestamp) {
        sample.timestamp = fallbackTimestamp;
    }
    var activeTransport = statsReport.get(activeTransportId);
    if (!activeTransport) {
        return sample;
    }
    var selectedCandidatePair = statsReport.get(activeTransport.selectedCandidatePairId);
    if (!selectedCandidatePair) {
        return sample;
    }
    var localCandidate = statsReport.get(selectedCandidatePair.localCandidateId);
    var remoteCandidate = statsReport.get(selectedCandidatePair.remoteCandidateId);
    Object.assign(sample, {
        localAddress: localCandidate && localCandidate.ip,
        remoteAddress: remoteCandidate && remoteCandidate.ip,
        rtt: selectedCandidatePair && (selectedCandidatePair.currentRoundTripTime * 1000)
    });
    return sample;
}
module.exports = getStatistics;

},{"./mockrtcstatsreport":16}],22:[function(require,module,exports){
var EventEmitter = require('events').EventEmitter;
function EventTarget() {
    Object.defineProperties(this, {
        _eventEmitter: {
            value: new EventEmitter()
        },
        _handlers: {
            value: {}
        },
    });
}
EventTarget.prototype.dispatchEvent = function dispatchEvent(event) {
    return this._eventEmitter.emit(event.type, event);
};
EventTarget.prototype.addEventListener = function addEventListener() {
    var _a;
    return (_a = this._eventEmitter).addListener.apply(_a, arguments);
};
EventTarget.prototype.removeEventListener = function removeEventListener() {
    var _a;
    return (_a = this._eventEmitter).removeListener.apply(_a, arguments);
};
EventTarget.prototype._defineEventHandler = function _defineEventHandler(eventName) {
    var self = this;
    Object.defineProperty(this, "on" + eventName, {
        get: function () {
            return self._handlers[eventName];
        },
        set: function (newHandler) {
            var oldHandler = self._handlers[eventName];
            if (oldHandler
                && (typeof newHandler === 'function'
                    || typeof newHandler === 'undefined'
                    || newHandler === null)) {
                self._handlers[eventName] = null;
                self.removeEventListener(eventName, oldHandler);
            }
            if (typeof newHandler === 'function') {
                self._handlers[eventName] = newHandler;
                self.addEventListener(eventName, newHandler);
            }
        }
    });
};
module.exports = EventTarget;

},{"events":40}],23:[function(require,module,exports){
function MediaDeviceInfoShim(options) {
    Object.defineProperties(this, {
        deviceId: { get: function () { return options.deviceId; } },
        groupId: { get: function () { return options.groupId; } },
        kind: { get: function () { return options.kind; } },
        label: { get: function () { return options.label; } },
    });
}
module.exports = MediaDeviceInfoShim;

},{}],24:[function(require,module,exports){
var EventTarget = require('./eventtarget');
var inherits = require('util').inherits;
var POLL_INTERVAL_MS = 500;
var nativeMediaDevices = typeof navigator !== 'undefined' && navigator.mediaDevices;
/**
 * Make a custom MediaDevices object, and proxy through existing functionality. If
 *   devicechange is present, we simply reemit the event. If not, we will do the
 *   detection ourselves and fire the event when necessary. The same logic exists
 *   for deviceinfochange for consistency, however deviceinfochange is our own event
 *   so it is unlikely that it will ever be native. The w3c spec for devicechange
 *   is unclear as to whether MediaDeviceInfo changes (such as label) will
 *   trigger the devicechange event. We have an open question on this here:
 *   https://bugs.chromium.org/p/chromium/issues/detail?id=585096
 */
function MediaDevicesShim() {
    EventTarget.call(this);
    this._defineEventHandler('devicechange');
    this._defineEventHandler('deviceinfochange');
    var knownDevices = [];
    Object.defineProperties(this, {
        _deviceChangeIsNative: {
            value: reemitNativeEvent(this, 'devicechange')
        },
        _deviceInfoChangeIsNative: {
            value: reemitNativeEvent(this, 'deviceinfochange')
        },
        _knownDevices: {
            value: knownDevices
        },
        _pollInterval: {
            value: null,
            writable: true
        }
    });
    if (typeof nativeMediaDevices.enumerateDevices === 'function') {
        nativeMediaDevices.enumerateDevices().then(function (devices) {
            devices.sort(sortDevicesById).forEach([].push, knownDevices);
        });
    }
    this._eventEmitter.on('newListener', function maybeStartPolling(eventName) {
        if (eventName !== 'devicechange' && eventName !== 'deviceinfochange') {
            return;
        }
        this._pollInterval = this._pollInterval
            || setInterval(sampleDevices.bind(null, this), POLL_INTERVAL_MS);
    }.bind(this));
    this._eventEmitter.on('removeListener', function maybeStopPolling() {
        if (this._pollInterval && !hasChangeListeners(this)) {
            clearInterval(this._pollInterval);
            this._pollInterval = null;
        }
    }.bind(this));
}
inherits(MediaDevicesShim, EventTarget);
if (nativeMediaDevices && typeof nativeMediaDevices.enumerateDevices === 'function') {
    MediaDevicesShim.prototype.enumerateDevices = function enumerateDevices() {
        return nativeMediaDevices.enumerateDevices.apply(nativeMediaDevices, arguments);
    };
}
MediaDevicesShim.prototype.getUserMedia = function getUserMedia() {
    return nativeMediaDevices.getUserMedia.apply(nativeMediaDevices, arguments);
};
function deviceInfosHaveChanged(newDevices, oldDevices) {
    var oldLabels = oldDevices.reduce(function (map, device) { return map.set(device.deviceId, device.label || null); }, new Map());
    return newDevices.some(function (newDevice) {
        var oldLabel = oldLabels.get(newDevice.deviceId);
        return typeof oldLabel !== 'undefined' && oldLabel !== newDevice.label;
    });
}
function devicesHaveChanged(newDevices, oldDevices) {
    return newDevices.length !== oldDevices.length
        || propertyHasChanged('deviceId', newDevices, oldDevices);
}
function hasChangeListeners(mediaDevices) {
    return ['devicechange', 'deviceinfochange'].reduce(function (count, event) { return count + mediaDevices._eventEmitter.listenerCount(event); }, 0) > 0;
}
/**
 * Sample the current set of devices and emit devicechange event if a device has been
 *   added or removed, and deviceinfochange if a device's label has changed.
 * @param {MediaDevicesShim} mediaDevices
 * @private
 */
function sampleDevices(mediaDevices) {
    nativeMediaDevices.enumerateDevices().then(function (newDevices) {
        var knownDevices = mediaDevices._knownDevices;
        var oldDevices = knownDevices.slice();
        // Replace known devices in-place
        [].splice.apply(knownDevices, [0, knownDevices.length]
            .concat(newDevices.sort(sortDevicesById)));
        if (!mediaDevices._deviceChangeIsNative
            && devicesHaveChanged(knownDevices, oldDevices)) {
            mediaDevices.dispatchEvent(new Event('devicechange'));
        }
        if (!mediaDevices._deviceInfoChangeIsNative
            && deviceInfosHaveChanged(knownDevices, oldDevices)) {
            mediaDevices.dispatchEvent(new Event('deviceinfochange'));
        }
    });
}
/**
 * Accepts two sorted arrays and the name of a property to compare on objects from each.
 *   Arrays should also be of the same length.
 * @param {string} propertyName - Name of the property to compare on each object
 * @param {Array<Object>} as - The left-side array of objects to compare.
 * @param {Array<Object>} bs - The right-side array of objects to compare.
 * @private
 * @returns {boolean} True if the property of any object in array A is different than
 *   the same property of its corresponding object in array B.
 */
function propertyHasChanged(propertyName, as, bs) {
    return as.some(function (a, i) { return a[propertyName] !== bs[i][propertyName]; });
}
/**
 * Re-emit the native event, if the native mediaDevices has the corresponding property.
 * @param {MediaDevicesShim} mediaDevices
 * @param {string} eventName - Name of the event
 * @private
 * @returns {boolean} Whether the native mediaDevice had the corresponding property
 */
function reemitNativeEvent(mediaDevices, eventName) {
    var methodName = "on" + eventName;
    function dispatchEvent(event) {
        mediaDevices.dispatchEvent(event);
    }
    if (methodName in nativeMediaDevices) {
        // Use addEventListener if it's available so we don't stomp on any other listeners
        // for this event. Currently, navigator.mediaDevices.addEventListener does not exist in Safari.
        if ('addEventListener' in nativeMediaDevices) {
            nativeMediaDevices.addEventListener(eventName, dispatchEvent);
        }
        else {
            nativeMediaDevices[methodName] = dispatchEvent;
        }
        return true;
    }
    return false;
}
function sortDevicesById(a, b) {
    return a.deviceId < b.deviceId;
}
module.exports = (function shimMediaDevices() {
    return nativeMediaDevices ? new MediaDevicesShim() : null;
})();

},{"./eventtarget":22,"util":51}],25:[function(require,module,exports){
var AudioPlayer = require('@twilio/audioplayer');
/**
 * @class
 * @param {string} name - Name of the sound
 * @param {string} url - URL of the sound
 * @param {Sound#ConstructorOptions} options
 * @property {boolean} isPlaying - Whether the Sound is currently playing audio.
 * @property {string} name - Name of the sound
 * @property {string} url - URL of the sound
 * @property {AudioContext} audioContext - The AudioContext to use if available for AudioPlayer.
 */ /**
* @typedef {Object} Sound#ConstructorOptions
* @property {number} [maxDuration=0] - The maximum length of time to play the sound
*   before stopping it.
* @property {Boolean} [shouldLoop=false] - Whether the sound should be looped.
*/
function Sound(name, url, options) {
    if (!(this instanceof Sound)) {
        return new Sound(name, url, options);
    }
    if (!name || !url) {
        throw new Error('name and url are required arguments');
    }
    options = Object.assign({
        AudioFactory: typeof Audio !== 'undefined' ? Audio : null,
        maxDuration: 0,
        shouldLoop: false
    }, options);
    options.AudioPlayer = options.audioContext
        ? AudioPlayer.bind(AudioPlayer, options.audioContext)
        : options.AudioFactory;
    Object.defineProperties(this, {
        _activeEls: {
            value: new Set()
        },
        _Audio: {
            value: options.AudioPlayer
        },
        _isSinkSupported: {
            value: options.AudioFactory !== null
                && typeof options.AudioFactory.prototype.setSinkId === 'function'
        },
        _maxDuration: {
            value: options.maxDuration
        },
        _maxDurationTimeout: {
            value: null,
            writable: true
        },
        _playPromise: {
            value: null,
            writable: true
        },
        _shouldLoop: {
            value: options.shouldLoop
        },
        _sinkIds: {
            value: ['default']
        },
        isPlaying: {
            enumerable: true,
            get: function () {
                return !!this._playPromise;
            }
        },
        name: {
            enumerable: true,
            value: name
        },
        url: {
            enumerable: true,
            value: url
        }
    });
    if (this._Audio) {
        preload(this._Audio, url);
    }
}
function preload(AudioFactory, url) {
    var el = new AudioFactory(url);
    el.preload = 'auto';
    el.muted = true;
    // Play it (muted) as soon as possible so that it does not get incorrectly caught by Chrome's
    // "gesture requirement for media playback" feature.
    // https://plus.google.com/+FrancoisBeaufort/posts/6PiJQqJzGqX
    el.play();
}
/**
 * Update the sinkIds of the audio output devices this sound should play through.
 */
Sound.prototype.setSinkIds = function setSinkIds(ids) {
    if (!this._isSinkSupported) {
        return;
    }
    ids = ids.forEach ? ids : [ids];
    [].splice.apply(this._sinkIds, [0, this._sinkIds.length].concat(ids));
};
/**
 * Stop playing the sound.
 * @return {void}
 */
Sound.prototype.stop = function stop() {
    this._activeEls.forEach(function (audioEl) {
        audioEl.pause();
        audioEl.src = '';
        audioEl.load();
    });
    this._activeEls.clear();
    clearTimeout(this._maxDurationTimeout);
    this._playPromise = null;
    this._maxDurationTimeout = null;
};
/**
 * Start playing the sound. Will stop the currently playing sound first.
 */
Sound.prototype.play = function play() {
    if (this.isPlaying) {
        this.stop();
    }
    if (this._maxDuration > 0) {
        this._maxDurationTimeout = setTimeout(this.stop.bind(this), this._maxDuration);
    }
    var self = this;
    var playPromise = this._playPromise = Promise.all(this._sinkIds.map(function createAudioElement(sinkId) {
        if (!self._Audio) {
            return Promise.resolve();
        }
        var audioElement = new self._Audio(self.url);
        audioElement.loop = self._shouldLoop;
        audioElement.addEventListener('ended', function () {
            self._activeEls.delete(audioElement);
        });
        /**
         * (rrowland) Bug in Chrome 53 & 54 prevents us from calling Audio.setSinkId without
         *   crashing the tab. https://bugs.chromium.org/p/chromium/issues/detail?id=655342
         */
        return new Promise(function (resolve) {
            audioElement.addEventListener('canplaythrough', resolve);
        }).then(function () {
            // If stop has already been called, or another play has been initiated,
            // bail out before setting up the element to play.
            if (!self.isPlaying || self._playPromise !== playPromise) {
                return Promise.resolve();
            }
            return (self._isSinkSupported
                ? audioElement.setSinkId(sinkId)
                : Promise.resolve()).then(function setSinkIdSuccess() {
                self._activeEls.add(audioElement);
                return audioElement.play();
            }).then(function playSuccess() {
                return audioElement;
            }, function playFailure(reason) {
                self._activeEls.delete(audioElement);
                throw reason;
            });
        });
    }));
    return playPromise;
};
module.exports = Sound;

},{"@twilio/audioplayer":32}],26:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var _a, _b;
/**
 * Valid LogLevels.
 */
var LogLevel;
(function (LogLevel) {
    LogLevel["Off"] = "off";
    LogLevel["Debug"] = "debug";
    LogLevel["Info"] = "info";
    LogLevel["Warn"] = "warn";
    LogLevel["Error"] = "error";
})(LogLevel = exports.LogLevel || (exports.LogLevel = {}));
/**
 * Methods to call on console to log each LogLevel.
 */
var logLevelMethods = (_a = {},
    _a[LogLevel.Debug] = 'info',
    _a[LogLevel.Info] = 'info',
    _a[LogLevel.Warn] = 'warn',
    _a[LogLevel.Error] = 'error',
    _a);
/**
 * Ranking of LogLevel keys to determine which logs to print for a given LogLevel.
 */
var logLevelRanks = (_b = {},
    _b[LogLevel.Debug] = 0,
    _b[LogLevel.Info] = 1,
    _b[LogLevel.Warn] = 2,
    _b[LogLevel.Error] = 3,
    _b[LogLevel.Off] = 4,
    _b);
var Log = /** @class */ (function () {
    /**
     * @param logLevel - The initial LogLevel threshold to display logs for.
     * @param options
     */
    function Log(_logLevel, options) {
        this._logLevel = _logLevel;
        this._console = console;
        if (options && options.console) {
            this._console = options.console;
        }
    }
    Object.defineProperty(Log.prototype, "logLevel", {
        /**
         * The current LogLevel threshold.
         */
        get: function () { return this._logLevel; },
        enumerable: true,
        configurable: true
    });
    /**
     * Log a console.info message if the current LogLevel threshold is 'debug'.
     * @param args - Any number of arguments to be passed to console.info
     */
    Log.prototype.debug = function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        this.log.apply(this, [LogLevel.Debug].concat(args));
    };
    /**
     * Log a console.error message if the current LogLevel threshold is 'error' or lower.
     * @param args - Any number of arguments to be passed to console.error
     */
    Log.prototype.error = function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        this.log.apply(this, [LogLevel.Error].concat(args));
    };
    /**
     * Log a console.info message if the current LogLevel threshold is 'info' or lower.
     * @param args - Any number of arguments to be passed to console.info
     */
    Log.prototype.info = function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        this.log.apply(this, [LogLevel.Info].concat(args));
    };
    /**
     * Log a console message if the current LogLevel threshold is equal to or less than the
     *   LogLevel specified.
     * @param logLevel - The LogLevel to compare to the current LogLevel to determine
     *   whether the log should be printed.
     * @param args - Any number of arguments to be passed to console
     */
    Log.prototype.log = function (logLevel) {
        var args = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            args[_i - 1] = arguments[_i];
        }
        var _a;
        var methodName = logLevelMethods[logLevel];
        if (methodName && logLevelRanks[this.logLevel] <= logLevelRanks[logLevel]) {
            (_a = this._console)[methodName].apply(_a, args);
        }
    };
    /**
     * Set/update the LogLevel threshold to apply to all future logs.
     * @param logLevel - The new LogLevel to use as a threshold for logs.
     */
    Log.prototype.setLogLevel = function (logLevel) {
        this._logLevel = logLevel;
    };
    /**
     * Log a console.warn message if the current LogLevel threshold is 'warn' or lower.
     * @param args - Any number of arguments to be passed to console.warn
     */
    Log.prototype.warn = function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        this.log.apply(this, [LogLevel.Warn].concat(args));
    };
    return Log;
}());
exports.default = Log;

},{}],27:[function(require,module,exports){
(function (global){
/**
 * Exception class.
 * @class
 * @name Exception
 * @exports Exception as Twilio.Exception
 * @memberOf Twilio
 * @param {string} message The exception message
 */
function TwilioException(message) {
    if (!(this instanceof TwilioException)) {
        return new TwilioException(message);
    }
    this.message = message;
}
/**
 * Returns the exception message.
 *
 * @return {string} The exception message.
 */
TwilioException.prototype.toString = function () {
    return "Twilio.Exception: " + this.message;
};
function average(values) {
    return values.reduce(function (t, v) { return t + v; }) / values.length;
}
function difference(lefts, rights, getKey) {
    getKey = getKey || (function (a) { return a; });
    var rightKeys = new Set(rights.map(getKey));
    return lefts.filter(function (left) { return !rightKeys.has(getKey(left)); });
}
function isFirefox(navigator) {
    navigator = navigator || (typeof window === 'undefined'
        ? global.navigator : window.navigator);
    return navigator && typeof navigator.userAgent === 'string'
        && /firefox|fxios/i.test(navigator.userAgent);
}
function isEdge(navigator) {
    navigator = navigator || (typeof window === 'undefined'
        ? global.navigator : window.navigator);
    return navigator && typeof navigator.userAgent === 'string'
        && /edge\/\d+/i.test(navigator.userAgent);
}
function queryToJson(params) {
    if (!params) {
        return '';
    }
    return params.split('&').reduce(function (output, pair) {
        var parts = pair.split('=');
        var key = parts[0];
        var value = decodeURIComponent((parts[1] || '').replace(/\+/g, '%20'));
        if (key) {
            output[key] = value;
        }
        return output;
    }, {});
}
exports.Exception = TwilioException;
exports.average = average;
exports.difference = difference;
exports.isFirefox = isFirefox;
exports.isEdge = isEdge;
exports.queryToJson = queryToJson;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],28:[function(require,module,exports){
"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
var events_1 = require("events");
var WebSocket = require("ws");
var tslog_1 = require("./tslog");
// tslint:disable-next-line
var Backoff = require('backoff');
var CONNECT_SUCCESS_TIMEOUT = 10000;
var CONNECT_TIMEOUT = 5000;
var HEARTBEAT_TIMEOUT = 15000;
/**
 * All possible states of WSTransport.
 */
var WSTransportState;
(function (WSTransportState) {
    /**
     * The WebSocket is not open but is trying to connect.
     */
    WSTransportState["Connecting"] = "connecting";
    /**
     * The WebSocket is not open and is not trying to connect.
     */
    WSTransportState["Closed"] = "closed";
    /**
     * The underlying WebSocket is open and active.
     */
    WSTransportState["Open"] = "open";
})(WSTransportState = exports.WSTransportState || (exports.WSTransportState = {}));
/**
 * WebSocket Transport
 */
var WSTransport = /** @class */ (function (_super) {
    __extends(WSTransport, _super);
    /**
     * @constructor
     * @param uri - The URI of the endpoint to connect to.
     * @param [options] - Constructor options.
     */
    function WSTransport(uri, options) {
        if (options === void 0) { options = {}; }
        var _this = _super.call(this) || this;
        /**
         * The current state of the WSTransport.
         */
        _this.state = WSTransportState.Closed;
        /**
         * The backoff instance used to schedule reconnection attempts.
         */
        _this._backoff = Backoff.exponential({
            factor: 1.5,
            initialDelay: 30,
            maxDelay: 3000,
            randomisationFactor: 0.25,
        });
        /**
         * Called in response to WebSocket#close event.
         */
        _this._onSocketClose = function () {
            _this._closeSocket();
        };
        /**
         * Called in response to WebSocket#error event.
         */
        _this._onSocketError = function (err) {
            _this._log.info("WebSocket received error: " + err.message);
            _this.emit('error', { code: 31000, message: err.message || 'WSTransport socket error' });
        };
        /**
         * Called in response to WebSocket#message event.
         */
        _this._onSocketMessage = function (message) {
            // Clear heartbeat timeout on any incoming message, as they
            // all indicate an active connection.
            _this._setHeartbeatTimeout();
            // Filter and respond to heartbeats
            if (_this._socket && message.data === '\n') {
                _this._socket.send('\n');
                return;
            }
            _this.emit('message', message);
        };
        /**
         * Called in response to WebSocket#open event.
         */
        _this._onSocketOpen = function () {
            _this._log.info('WebSocket opened successfully.');
            _this._timeOpened = Date.now();
            _this.state = WSTransportState.Open;
            clearTimeout(_this._connectTimeout);
            _this._setHeartbeatTimeout();
            _this.emit('open');
        };
        _this._log = new tslog_1.default(options.logLevel || tslog_1.LogLevel.Off);
        _this._uri = uri;
        _this._WebSocket = options.WebSocket || WebSocket;
        // Called when a backoff timer is started.
        _this._backoff.on('backoff', function (_, delay) {
            if (_this.state === WSTransportState.Closed) {
                return;
            }
            _this._log.info("Will attempt to reconnect WebSocket in " + delay + "ms");
        });
        // Called when a backoff timer ends. We want to try to reconnect
        // the WebSocket at this point.
        _this._backoff.on('ready', function (attempt) {
            if (_this.state === WSTransportState.Closed) {
                return;
            }
            _this._connect(attempt + 1);
        });
        return _this;
    }
    /**
     * Close the WebSocket, and don't try to reconnect.
     */
    WSTransport.prototype.close = function () {
        this._log.info('WSTransport.close() called...');
        this._close();
    };
    /**
     * Attempt to open a WebSocket connection.
     */
    WSTransport.prototype.open = function () {
        this._log.info('WSTransport.open() called...');
        if (this._socket &&
            (this._socket.readyState === WebSocket.CONNECTING ||
                this._socket.readyState === WebSocket.OPEN)) {
            this._log.info('WebSocket already open.');
            return;
        }
        this._connect();
    };
    /**
     * Send a message through the WebSocket connection.
     * @param message - A message to send to the endpoint.
     * @returns Whether the message was sent.
     */
    WSTransport.prototype.send = function (message) {
        // We can't send the message if the WebSocket isn't open
        if (!this._socket || this._socket.readyState !== WebSocket.OPEN) {
            return false;
        }
        try {
            this._socket.send(message);
        }
        catch (e) {
            // Some unknown error occurred. Reset the socket to get a fresh session.
            this._log.info('Error while sending message:', e.message);
            this._closeSocket();
            return false;
        }
        return true;
    };
    /**
     * Close the WebSocket, and don't try to reconnect.
     */
    WSTransport.prototype._close = function () {
        this.state = WSTransportState.Closed;
        this._closeSocket();
    };
    /**
     * Close the WebSocket and remove all event listeners.
     */
    WSTransport.prototype._closeSocket = function () {
        clearTimeout(this._connectTimeout);
        clearTimeout(this._heartbeatTimeout);
        this._log.info('Closing and cleaning up WebSocket...');
        if (!this._socket) {
            this._log.info('No WebSocket to clean up.');
            return;
        }
        this._socket.removeEventListener('close', this._onSocketClose);
        this._socket.removeEventListener('error', this._onSocketError);
        this._socket.removeEventListener('message', this._onSocketMessage);
        this._socket.removeEventListener('open', this._onSocketOpen);
        if (this._socket.readyState === WebSocket.CONNECTING ||
            this._socket.readyState === WebSocket.OPEN) {
            this._socket.close();
        }
        // Reset backoff counter if connection was open for long enough to be considered successful
        if (this._timeOpened && Date.now() - this._timeOpened > CONNECT_SUCCESS_TIMEOUT) {
            this._backoff.reset();
        }
        this._backoff.backoff();
        delete this._socket;
        this.emit('close');
    };
    /**
     * Attempt to connect to the endpoint via WebSocket.
     * @param [retryCount] - Retry number, if this is a retry. Undefined if
     *   first attempt, 1+ if a retry.
     */
    WSTransport.prototype._connect = function (retryCount) {
        var _this = this;
        if (retryCount) {
            this._log.info("Attempting to reconnect (retry #" + retryCount + ")...");
        }
        else {
            this._log.info('Attempting to connect...');
        }
        this._closeSocket();
        this.state = WSTransportState.Connecting;
        var socket = null;
        try {
            socket = new this._WebSocket(this._uri);
        }
        catch (e) {
            this._log.info('Could not connect to endpoint:', e.message);
            this._close();
            this.emit('error', { code: 31000, message: e.message || "Could not connect to " + this._uri });
            return;
        }
        delete this._timeOpened;
        this._connectTimeout = setTimeout(function () {
            _this._log.info('WebSocket connection attempt timed out.');
            _this._closeSocket();
        }, CONNECT_TIMEOUT);
        socket.addEventListener('close', this._onSocketClose);
        socket.addEventListener('error', this._onSocketError);
        socket.addEventListener('message', this._onSocketMessage);
        socket.addEventListener('open', this._onSocketOpen);
        this._socket = socket;
    };
    /**
     * Set a timeout to reconnect after HEARTBEAT_TIMEOUT milliseconds
     *   have passed without receiving a message over the WebSocket.
     */
    WSTransport.prototype._setHeartbeatTimeout = function () {
        var _this = this;
        clearTimeout(this._heartbeatTimeout);
        this._heartbeatTimeout = setTimeout(function () {
            _this._log.info("No messages received in " + HEARTBEAT_TIMEOUT / 1000 + " seconds. Reconnecting...");
            _this._closeSocket();
        }, HEARTBEAT_TIMEOUT);
    };
    return WSTransport;
}(events_1.EventEmitter));
exports.default = WSTransport;

},{"./tslog":26,"backoff":34,"events":40,"ws":1}],29:[function(require,module,exports){
"use strict";

var _regenerator = require("babel-runtime/regenerator");

var _regenerator2 = _interopRequireDefault(_regenerator);

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var __awaiter = undefined && undefined.__awaiter || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) {
            try {
                step(generator.next(value));
            } catch (e) {
                reject(e);
            }
        }
        function rejected(value) {
            try {
                step(generator["throw"](value));
            } catch (e) {
                reject(e);
            }
        }
        function step(result) {
            result.done ? resolve(result.value) : new P(function (resolve) {
                resolve(result.value);
            }).then(fulfilled, rejected);
        }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
var Deferred_1 = require("./Deferred");
var EventTarget_1 = require("./EventTarget");
/**
 * An {@link AudioPlayer} is an HTMLAudioElement-like object that uses AudioContext
 *   to circumvent browser limitations.
 */

var AudioPlayer = function (_EventTarget_1$defaul) {
    _inherits(AudioPlayer, _EventTarget_1$defaul);

    /**
     * @private
     */
    function AudioPlayer(audioContext) {
        var srcOrOptions = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
        var options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};

        _classCallCheck(this, AudioPlayer);

        /**
         * The AudioBufferSourceNode of the actively loaded sound. Null if a sound
         *   has not been loaded yet. This is re-used for each time the sound is
         *   played.
         */
        var _this = _possibleConstructorReturn(this, (AudioPlayer.__proto__ || Object.getPrototypeOf(AudioPlayer)).call(this));

        _this._audioNode = null;
        /**
         * An Array of deferred-like objects for each pending `play` Promise. When
         *   .pause() is called or .src is set, all pending play Promises are
         *   immediately rejected.
         */
        _this._pendingPlayDeferreds = [];
        /**
         * Whether or not the audio element should loop. If disabled during playback,
         *   playing continues until the sound ends and then stops looping.
         */
        _this._loop = false;
        /**
         * The source URL of the sound to play. When set, the currently playing sound will stop.
         */
        _this._src = '';
        /**
         * The current sinkId of the device audio is being played through.
         */
        _this._sinkId = 'default';
        if (typeof srcOrOptions !== 'string') {
            options = srcOrOptions;
        }
        _this._audioContext = audioContext;
        _this._audioElement = new (options.AudioFactory || Audio)();
        _this._bufferPromise = _this._createPlayDeferred().promise;
        _this._destination = _this._audioContext.destination;
        _this._gainNode = _this._audioContext.createGain();
        _this._gainNode.connect(_this._destination);
        _this._XMLHttpRequest = options.XMLHttpRequestFactory || XMLHttpRequest;
        _this.addEventListener('canplaythrough', function () {
            _this._resolvePlayDeferreds();
        });
        if (typeof srcOrOptions === 'string') {
            _this.src = srcOrOptions;
        }
        return _this;
    }

    _createClass(AudioPlayer, [{
        key: "load",

        /**
         * Stop any ongoing playback and reload the source file.
         */
        value: function load() {
            this._load(this._src);
        }
        /**
         * Pause the audio coming from this AudioPlayer. This will reject any pending
         *   play Promises.
         */

    }, {
        key: "pause",
        value: function pause() {
            if (this.paused) {
                return;
            }
            this._audioElement.pause();
            this._audioNode.stop();
            this._audioNode.disconnect(this._gainNode);
            this._audioNode = null;
            this._rejectPlayDeferreds(new Error('The play() request was interrupted by a call to pause().'));
        }
        /**
         * Play the sound. If the buffer hasn't loaded yet, wait for the buffer to load. If
         *   the source URL is not set yet, this Promise will remain pending until a source
         *   URL is set.
         */

    }, {
        key: "play",
        value: function play() {
            return __awaiter(this, void 0, void 0, /*#__PURE__*/_regenerator2.default.mark(function _callee() {
                var _this2 = this;

                var buffer;
                return _regenerator2.default.wrap(function _callee$(_context) {
                    while (1) {
                        switch (_context.prev = _context.next) {
                            case 0:
                                if (this.paused) {
                                    _context.next = 6;
                                    break;
                                }

                                _context.next = 3;
                                return this._bufferPromise;

                            case 3:
                                if (this.paused) {
                                    _context.next = 5;
                                    break;
                                }

                                return _context.abrupt("return");

                            case 5:
                                throw new Error('The play() request was interrupted by a call to pause().');

                            case 6:
                                this._audioNode = this._audioContext.createBufferSource();
                                this._audioNode.loop = this.loop;
                                this._audioNode.addEventListener('ended', function () {
                                    if (_this2._audioNode && _this2._audioNode.loop) {
                                        return;
                                    }
                                    _this2.dispatchEvent('ended');
                                });
                                _context.next = 11;
                                return this._bufferPromise;

                            case 11:
                                buffer = _context.sent;

                                if (!this.paused) {
                                    _context.next = 14;
                                    break;
                                }

                                throw new Error('The play() request was interrupted by a call to pause().');

                            case 14:
                                this._audioNode.buffer = buffer;
                                this._audioNode.connect(this._gainNode);
                                this._audioNode.start();

                                if (!this._audioElement.srcObject) {
                                    _context.next = 19;
                                    break;
                                }

                                return _context.abrupt("return", this._audioElement.play());

                            case 19:
                            case "end":
                                return _context.stop();
                        }
                    }
                }, _callee, this);
            }));
        }
        /**
         * Change which device the sound should play through.
         * @param sinkId - The sink of the device to play sound through.
         */

    }, {
        key: "setSinkId",
        value: function setSinkId(sinkId) {
            return __awaiter(this, void 0, void 0, /*#__PURE__*/_regenerator2.default.mark(function _callee2() {
                return _regenerator2.default.wrap(function _callee2$(_context2) {
                    while (1) {
                        switch (_context2.prev = _context2.next) {
                            case 0:
                                if (!(typeof this._audioElement.setSinkId !== 'function')) {
                                    _context2.next = 2;
                                    break;
                                }

                                throw new Error('This browser does not support setSinkId.');

                            case 2:
                                if (!(sinkId === this.sinkId)) {
                                    _context2.next = 4;
                                    break;
                                }

                                return _context2.abrupt("return");

                            case 4:
                                if (!(sinkId === 'default')) {
                                    _context2.next = 11;
                                    break;
                                }

                                if (!this.paused) {
                                    this._gainNode.disconnect(this._destination);
                                }
                                this._audioElement.srcObject = null;
                                this._destination = this._audioContext.destination;
                                this._gainNode.connect(this._destination);
                                this._sinkId = sinkId;
                                return _context2.abrupt("return");

                            case 11:
                                _context2.next = 13;
                                return this._audioElement.setSinkId(sinkId);

                            case 13:
                                if (!this._audioElement.srcObject) {
                                    _context2.next = 15;
                                    break;
                                }

                                return _context2.abrupt("return");

                            case 15:
                                this._gainNode.disconnect(this._audioContext.destination);
                                this._destination = this._audioContext.createMediaStreamDestination();
                                this._audioElement.srcObject = this._destination.stream;
                                this._sinkId = sinkId;
                                this._gainNode.connect(this._destination);

                            case 20:
                            case "end":
                                return _context2.stop();
                        }
                    }
                }, _callee2, this);
            }));
        }
        /**
         * Create a Deferred for a Promise that will be resolved when .src is set or rejected
         *   when .pause is called.
         */

    }, {
        key: "_createPlayDeferred",
        value: function _createPlayDeferred() {
            var deferred = new Deferred_1.default();
            this._pendingPlayDeferreds.push(deferred);
            return deferred;
        }
        /**
         * Stop current playback and load a sound file.
         * @param src - The source URL of the file to load
         */

    }, {
        key: "_load",
        value: function _load(src) {
            var _this3 = this;

            if (this._src && this._src !== src) {
                this.pause();
            }
            this._src = src;
            this._bufferPromise = new Promise(function (resolve, reject) {
                return __awaiter(_this3, void 0, void 0, /*#__PURE__*/_regenerator2.default.mark(function _callee3() {
                    var buffer;
                    return _regenerator2.default.wrap(function _callee3$(_context3) {
                        while (1) {
                            switch (_context3.prev = _context3.next) {
                                case 0:
                                    if (src) {
                                        _context3.next = 2;
                                        break;
                                    }

                                    return _context3.abrupt("return", this._createPlayDeferred().promise);

                                case 2:
                                    _context3.next = 4;
                                    return bufferSound(this._audioContext, this._XMLHttpRequest, src);

                                case 4:
                                    buffer = _context3.sent;

                                    this.dispatchEvent('canplaythrough');
                                    resolve(buffer);

                                case 7:
                                case "end":
                                    return _context3.stop();
                            }
                        }
                    }, _callee3, this);
                }));
            });
        }
        /**
         * Reject all deferreds for the Play promise.
         * @param reason
         */

    }, {
        key: "_rejectPlayDeferreds",
        value: function _rejectPlayDeferreds(reason) {
            var deferreds = this._pendingPlayDeferreds;
            deferreds.splice(0, deferreds.length).forEach(function (_ref) {
                var reject = _ref.reject;
                return reject(reason);
            });
        }
        /**
         * Resolve all deferreds for the Play promise.
         * @param result
         */

    }, {
        key: "_resolvePlayDeferreds",
        value: function _resolvePlayDeferreds(result) {
            var deferreds = this._pendingPlayDeferreds;
            deferreds.splice(0, deferreds.length).forEach(function (_ref2) {
                var resolve = _ref2.resolve;
                return resolve(result);
            });
        }
    }, {
        key: "destination",
        get: function get() {
            return this._destination;
        }
    }, {
        key: "loop",
        get: function get() {
            return this._loop;
        },
        set: function set(shouldLoop) {
            // If a sound is already looping, it should continue playing
            //   the current playthrough and then stop.
            if (!shouldLoop && this.loop && !this.paused) {
                var _pauseAfterPlaythrough = function _pauseAfterPlaythrough() {
                    self._audioNode.removeEventListener('ended', _pauseAfterPlaythrough);
                    self.pause();
                };

                var self = this;

                this._audioNode.addEventListener('ended', _pauseAfterPlaythrough);
            }
            this._loop = shouldLoop;
        }
        /**
         * Whether the audio element is muted.
         */

    }, {
        key: "muted",
        get: function get() {
            return this._gainNode.gain.value === 0;
        },
        set: function set(shouldBeMuted) {
            this._gainNode.gain.value = shouldBeMuted ? 0 : 1;
        }
        /**
         * Whether the sound is paused. this._audioNode only exists when sound is playing;
         *   otherwise AudioPlayer is considered paused.
         */

    }, {
        key: "paused",
        get: function get() {
            return this._audioNode === null;
        }
    }, {
        key: "src",
        get: function get() {
            return this._src;
        },
        set: function set(src) {
            this._load(src);
        }
    }, {
        key: "sinkId",
        get: function get() {
            return this._sinkId;
        }
    }]);

    return AudioPlayer;
}(EventTarget_1.default);

exports.default = AudioPlayer;
/**
 * Use XMLHttpRequest to load the AudioBuffer of a remote audio asset.
 * @private
 * @param context - The AudioContext to use to decode the audio data
 * @param RequestFactory - The XMLHttpRequest factory to build
 * @param src - The URL of the audio asset to load.
 * @returns A Promise containing the decoded AudioBuffer.
 */
// tslint:disable-next-line:variable-name
function bufferSound(context, RequestFactory, src) {
    return __awaiter(this, void 0, void 0, /*#__PURE__*/_regenerator2.default.mark(function _callee4() {
        var request, event;
        return _regenerator2.default.wrap(function _callee4$(_context4) {
            while (1) {
                switch (_context4.prev = _context4.next) {
                    case 0:
                        request = new RequestFactory();

                        request.open('GET', src, true);
                        request.responseType = 'arraybuffer';
                        _context4.next = 5;
                        return new Promise(function (resolve) {
                            request.addEventListener('load', resolve);
                            request.send();
                        });

                    case 5:
                        event = _context4.sent;
                        _context4.prev = 6;
                        return _context4.abrupt("return", context.decodeAudioData(event.target.response));

                    case 10:
                        _context4.prev = 10;
                        _context4.t0 = _context4["catch"](6);
                        return _context4.abrupt("return", new Promise(function (resolve) {
                            context.decodeAudioData(event.target.response, resolve);
                        }));

                    case 13:
                    case "end":
                        return _context4.stop();
                }
            }
        }, _callee4, this, [[6, 10]]);
    }));
}

},{"./Deferred":30,"./EventTarget":31,"babel-runtime/regenerator":33}],30:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

Object.defineProperty(exports, "__esModule", { value: true });

var Deferred = function () {
    function Deferred() {
        var _this = this;

        _classCallCheck(this, Deferred);

        this.promise = new Promise(function (resolve, reject) {
            _this._resolve = resolve;
            _this._reject = reject;
        });
    }

    _createClass(Deferred, [{
        key: "reject",
        get: function get() {
            return this._reject;
        }
    }, {
        key: "resolve",
        get: function get() {
            return this._resolve;
        }
    }]);

    return Deferred;
}();

exports.default = Deferred;

},{}],31:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

Object.defineProperty(exports, "__esModule", { value: true });
var events_1 = require("events");

var EventTarget = function () {
    function EventTarget() {
        _classCallCheck(this, EventTarget);

        this._eventEmitter = new events_1.EventEmitter();
    }

    _createClass(EventTarget, [{
        key: "addEventListener",
        value: function addEventListener(name, handler) {
            return this._eventEmitter.addListener(name, handler);
        }
    }, {
        key: "dispatchEvent",
        value: function dispatchEvent(name) {
            var _eventEmitter;

            for (var _len = arguments.length, args = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
                args[_key - 1] = arguments[_key];
            }

            return (_eventEmitter = this._eventEmitter).emit.apply(_eventEmitter, [name].concat(args));
        }
    }, {
        key: "removeEventListener",
        value: function removeEventListener(name, handler) {
            return this._eventEmitter.removeListener(name, handler);
        }
    }]);

    return EventTarget;
}();

exports.default = EventTarget;

},{"events":40}],32:[function(require,module,exports){
'use strict';

var AudioPlayer = require('./AudioPlayer');

module.exports = AudioPlayer.default;
},{"./AudioPlayer":29}],33:[function(require,module,exports){
module.exports = require("regenerator-runtime");

},{"regenerator-runtime":46}],34:[function(require,module,exports){
//      Copyright (c) 2012 Mathieu Turcotte
//      Licensed under the MIT license.

var Backoff = require('./lib/backoff');
var ExponentialBackoffStrategy = require('./lib/strategy/exponential');
var FibonacciBackoffStrategy = require('./lib/strategy/fibonacci');
var FunctionCall = require('./lib/function_call.js');

module.exports.Backoff = Backoff;
module.exports.FunctionCall = FunctionCall;
module.exports.FibonacciStrategy = FibonacciBackoffStrategy;
module.exports.ExponentialStrategy = ExponentialBackoffStrategy;

// Constructs a Fibonacci backoff.
module.exports.fibonacci = function(options) {
    return new Backoff(new FibonacciBackoffStrategy(options));
};

// Constructs an exponential backoff.
module.exports.exponential = function(options) {
    return new Backoff(new ExponentialBackoffStrategy(options));
};

// Constructs a FunctionCall for the given function and arguments.
module.exports.call = function(fn, vargs, callback) {
    var args = Array.prototype.slice.call(arguments);
    fn = args[0];
    vargs = args.slice(1, args.length - 1);
    callback = args[args.length - 1];
    return new FunctionCall(fn, vargs, callback);
};

},{"./lib/backoff":35,"./lib/function_call.js":36,"./lib/strategy/exponential":37,"./lib/strategy/fibonacci":38}],35:[function(require,module,exports){
//      Copyright (c) 2012 Mathieu Turcotte
//      Licensed under the MIT license.

var events = require('events');
var precond = require('precond');
var util = require('util');

// A class to hold the state of a backoff operation. Accepts a backoff strategy
// to generate the backoff delays.
function Backoff(backoffStrategy) {
    events.EventEmitter.call(this);

    this.backoffStrategy_ = backoffStrategy;
    this.maxNumberOfRetry_ = -1;
    this.backoffNumber_ = 0;
    this.backoffDelay_ = 0;
    this.timeoutID_ = -1;

    this.handlers = {
        backoff: this.onBackoff_.bind(this)
    };
}
util.inherits(Backoff, events.EventEmitter);

// Sets a limit, greater than 0, on the maximum number of backoffs. A 'fail'
// event will be emitted when the limit is reached.
Backoff.prototype.failAfter = function(maxNumberOfRetry) {
    precond.checkArgument(maxNumberOfRetry > 0,
        'Expected a maximum number of retry greater than 0 but got %s.',
        maxNumberOfRetry);

    this.maxNumberOfRetry_ = maxNumberOfRetry;
};

// Starts a backoff operation. Accepts an optional parameter to let the
// listeners know why the backoff operation was started.
Backoff.prototype.backoff = function(err) {
    precond.checkState(this.timeoutID_ === -1, 'Backoff in progress.');

    if (this.backoffNumber_ === this.maxNumberOfRetry_) {
        this.emit('fail', err);
        this.reset();
    } else {
        this.backoffDelay_ = this.backoffStrategy_.next();
        this.timeoutID_ = setTimeout(this.handlers.backoff, this.backoffDelay_);
        this.emit('backoff', this.backoffNumber_, this.backoffDelay_, err);
    }
};

// Handles the backoff timeout completion.
Backoff.prototype.onBackoff_ = function() {
    this.timeoutID_ = -1;
    this.emit('ready', this.backoffNumber_, this.backoffDelay_);
    this.backoffNumber_++;
};

// Stops any backoff operation and resets the backoff delay to its inital value.
Backoff.prototype.reset = function() {
    this.backoffNumber_ = 0;
    this.backoffStrategy_.reset();
    clearTimeout(this.timeoutID_);
    this.timeoutID_ = -1;
};

module.exports = Backoff;

},{"events":40,"precond":42,"util":51}],36:[function(require,module,exports){
//      Copyright (c) 2012 Mathieu Turcotte
//      Licensed under the MIT license.

var events = require('events');
var precond = require('precond');
var util = require('util');

var Backoff = require('./backoff');
var FibonacciBackoffStrategy = require('./strategy/fibonacci');

// Wraps a function to be called in a backoff loop.
function FunctionCall(fn, args, callback) {
    events.EventEmitter.call(this);

    precond.checkIsFunction(fn, 'Expected fn to be a function.');
    precond.checkIsArray(args, 'Expected args to be an array.');
    precond.checkIsFunction(callback, 'Expected callback to be a function.');

    this.function_ = fn;
    this.arguments_ = args;
    this.callback_ = callback;
    this.lastResult_ = [];
    this.numRetries_ = 0;

    this.backoff_ = null;
    this.strategy_ = null;
    this.failAfter_ = -1;
    this.retryPredicate_ = FunctionCall.DEFAULT_RETRY_PREDICATE_;

    this.state_ = FunctionCall.State_.PENDING;
}
util.inherits(FunctionCall, events.EventEmitter);

// States in which the call can be.
FunctionCall.State_ = {
    // Call isn't started yet.
    PENDING: 0,
    // Call is in progress.
    RUNNING: 1,
    // Call completed successfully which means that either the wrapped function
    // returned successfully or the maximal number of backoffs was reached.
    COMPLETED: 2,
    // The call was aborted.
    ABORTED: 3
};

// The default retry predicate which considers any error as retriable.
FunctionCall.DEFAULT_RETRY_PREDICATE_ = function(err) {
  return true;
};

// Checks whether the call is pending.
FunctionCall.prototype.isPending = function() {
    return this.state_ == FunctionCall.State_.PENDING;
};

// Checks whether the call is in progress.
FunctionCall.prototype.isRunning = function() {
    return this.state_ == FunctionCall.State_.RUNNING;
};

// Checks whether the call is completed.
FunctionCall.prototype.isCompleted = function() {
    return this.state_ == FunctionCall.State_.COMPLETED;
};

// Checks whether the call is aborted.
FunctionCall.prototype.isAborted = function() {
    return this.state_ == FunctionCall.State_.ABORTED;
};

// Sets the backoff strategy to use. Can only be called before the call is
// started otherwise an exception will be thrown.
FunctionCall.prototype.setStrategy = function(strategy) {
    precond.checkState(this.isPending(), 'FunctionCall in progress.');
    this.strategy_ = strategy;
    return this; // Return this for chaining.
};

// Sets the predicate which will be used to determine whether the errors
// returned from the wrapped function should be retried or not, e.g. a
// network error would be retriable while a type error would stop the
// function call.
FunctionCall.prototype.retryIf = function(retryPredicate) {
    precond.checkState(this.isPending(), 'FunctionCall in progress.');
    this.retryPredicate_ = retryPredicate;
    return this;
};

// Returns all intermediary results returned by the wrapped function since
// the initial call.
FunctionCall.prototype.getLastResult = function() {
    return this.lastResult_.concat();
};

// Returns the number of times the wrapped function call was retried.
FunctionCall.prototype.getNumRetries = function() {
    return this.numRetries_;
};

// Sets the backoff limit.
FunctionCall.prototype.failAfter = function(maxNumberOfRetry) {
    precond.checkState(this.isPending(), 'FunctionCall in progress.');
    this.failAfter_ = maxNumberOfRetry;
    return this; // Return this for chaining.
};

// Aborts the call.
FunctionCall.prototype.abort = function() {
    if (this.isCompleted() || this.isAborted()) {
      return;
    }

    if (this.isRunning()) {
        this.backoff_.reset();
    }

    this.state_ = FunctionCall.State_.ABORTED;
    this.lastResult_ = [new Error('Backoff aborted.')];
    this.emit('abort');
    this.doCallback_();
};

// Initiates the call to the wrapped function. Accepts an optional factory
// function used to create the backoff instance; used when testing.
FunctionCall.prototype.start = function(backoffFactory) {
    precond.checkState(!this.isAborted(), 'FunctionCall is aborted.');
    precond.checkState(this.isPending(), 'FunctionCall already started.');

    var strategy = this.strategy_ || new FibonacciBackoffStrategy();

    this.backoff_ = backoffFactory ?
        backoffFactory(strategy) :
        new Backoff(strategy);

    this.backoff_.on('ready', this.doCall_.bind(this, true /* isRetry */));
    this.backoff_.on('fail', this.doCallback_.bind(this));
    this.backoff_.on('backoff', this.handleBackoff_.bind(this));

    if (this.failAfter_ > 0) {
        this.backoff_.failAfter(this.failAfter_);
    }

    this.state_ = FunctionCall.State_.RUNNING;
    this.doCall_(false /* isRetry */);
};

// Calls the wrapped function.
FunctionCall.prototype.doCall_ = function(isRetry) {
    if (isRetry) {
        this.numRetries_++;
    }
    var eventArgs = ['call'].concat(this.arguments_);
    events.EventEmitter.prototype.emit.apply(this, eventArgs);
    var callback = this.handleFunctionCallback_.bind(this);
    this.function_.apply(null, this.arguments_.concat(callback));
};

// Calls the wrapped function's callback with the last result returned by the
// wrapped function.
FunctionCall.prototype.doCallback_ = function() {
    this.callback_.apply(null, this.lastResult_);
};

// Handles wrapped function's completion. This method acts as a replacement
// for the original callback function.
FunctionCall.prototype.handleFunctionCallback_ = function() {
    if (this.isAborted()) {
        return;
    }

    var args = Array.prototype.slice.call(arguments);
    this.lastResult_ = args; // Save last callback arguments.
    events.EventEmitter.prototype.emit.apply(this, ['callback'].concat(args));

    var err = args[0];
    if (err && this.retryPredicate_(err)) {
        this.backoff_.backoff(err);
    } else {
        this.state_ = FunctionCall.State_.COMPLETED;
        this.doCallback_();
    }
};

// Handles the backoff event by reemitting it.
FunctionCall.prototype.handleBackoff_ = function(number, delay, err) {
    this.emit('backoff', number, delay, err);
};

module.exports = FunctionCall;

},{"./backoff":35,"./strategy/fibonacci":38,"events":40,"precond":42,"util":51}],37:[function(require,module,exports){
//      Copyright (c) 2012 Mathieu Turcotte
//      Licensed under the MIT license.

var util = require('util');
var precond = require('precond');

var BackoffStrategy = require('./strategy');

// Exponential backoff strategy.
function ExponentialBackoffStrategy(options) {
    BackoffStrategy.call(this, options);
    this.backoffDelay_ = 0;
    this.nextBackoffDelay_ = this.getInitialDelay();
    this.factor_ = ExponentialBackoffStrategy.DEFAULT_FACTOR;

    if (options && options.factor !== undefined) {
        precond.checkArgument(options.factor > 1,
            'Exponential factor should be greater than 1 but got %s.',
            options.factor);
        this.factor_ = options.factor;
    }
}
util.inherits(ExponentialBackoffStrategy, BackoffStrategy);

// Default multiplication factor used to compute the next backoff delay from
// the current one. The value can be overridden by passing a custom factor as
// part of the options.
ExponentialBackoffStrategy.DEFAULT_FACTOR = 2;

ExponentialBackoffStrategy.prototype.next_ = function() {
    this.backoffDelay_ = Math.min(this.nextBackoffDelay_, this.getMaxDelay());
    this.nextBackoffDelay_ = this.backoffDelay_ * this.factor_;
    return this.backoffDelay_;
};

ExponentialBackoffStrategy.prototype.reset_ = function() {
    this.backoffDelay_ = 0;
    this.nextBackoffDelay_ = this.getInitialDelay();
};

module.exports = ExponentialBackoffStrategy;

},{"./strategy":39,"precond":42,"util":51}],38:[function(require,module,exports){
//      Copyright (c) 2012 Mathieu Turcotte
//      Licensed under the MIT license.

var util = require('util');

var BackoffStrategy = require('./strategy');

// Fibonacci backoff strategy.
function FibonacciBackoffStrategy(options) {
    BackoffStrategy.call(this, options);
    this.backoffDelay_ = 0;
    this.nextBackoffDelay_ = this.getInitialDelay();
}
util.inherits(FibonacciBackoffStrategy, BackoffStrategy);

FibonacciBackoffStrategy.prototype.next_ = function() {
    var backoffDelay = Math.min(this.nextBackoffDelay_, this.getMaxDelay());
    this.nextBackoffDelay_ += this.backoffDelay_;
    this.backoffDelay_ = backoffDelay;
    return backoffDelay;
};

FibonacciBackoffStrategy.prototype.reset_ = function() {
    this.nextBackoffDelay_ = this.getInitialDelay();
    this.backoffDelay_ = 0;
};

module.exports = FibonacciBackoffStrategy;

},{"./strategy":39,"util":51}],39:[function(require,module,exports){
//      Copyright (c) 2012 Mathieu Turcotte
//      Licensed under the MIT license.

var events = require('events');
var util = require('util');

function isDef(value) {
    return value !== undefined && value !== null;
}

// Abstract class defining the skeleton for the backoff strategies. Accepts an
// object holding the options for the backoff strategy:
//
//  * `randomisationFactor`: The randomisation factor which must be between 0
//     and 1 where 1 equates to a randomization factor of 100% and 0 to no
//     randomization.
//  * `initialDelay`: The backoff initial delay in milliseconds.
//  * `maxDelay`: The backoff maximal delay in milliseconds.
function BackoffStrategy(options) {
    options = options || {};

    if (isDef(options.initialDelay) && options.initialDelay < 1) {
        throw new Error('The initial timeout must be greater than 0.');
    } else if (isDef(options.maxDelay) && options.maxDelay < 1) {
        throw new Error('The maximal timeout must be greater than 0.');
    }

    this.initialDelay_ = options.initialDelay || 100;
    this.maxDelay_ = options.maxDelay || 10000;

    if (this.maxDelay_ <= this.initialDelay_) {
        throw new Error('The maximal backoff delay must be ' +
                        'greater than the initial backoff delay.');
    }

    if (isDef(options.randomisationFactor) &&
        (options.randomisationFactor < 0 || options.randomisationFactor > 1)) {
        throw new Error('The randomisation factor must be between 0 and 1.');
    }

    this.randomisationFactor_ = options.randomisationFactor || 0;
}

// Gets the maximal backoff delay.
BackoffStrategy.prototype.getMaxDelay = function() {
    return this.maxDelay_;
};

// Gets the initial backoff delay.
BackoffStrategy.prototype.getInitialDelay = function() {
    return this.initialDelay_;
};

// Template method that computes and returns the next backoff delay in
// milliseconds.
BackoffStrategy.prototype.next = function() {
    var backoffDelay = this.next_();
    var randomisationMultiple = 1 + Math.random() * this.randomisationFactor_;
    var randomizedDelay = Math.round(backoffDelay * randomisationMultiple);
    return randomizedDelay;
};

// Computes and returns the next backoff delay. Intended to be overridden by
// subclasses.
BackoffStrategy.prototype.next_ = function() {
    throw new Error('BackoffStrategy.next_() unimplemented.');
};

// Template method that resets the backoff delay to its initial value.
BackoffStrategy.prototype.reset = function() {
    this.reset_();
};

// Resets the backoff delay to its initial value. Intended to be overridden by
// subclasses.
BackoffStrategy.prototype.reset_ = function() {
    throw new Error('BackoffStrategy.reset_() unimplemented.');
};

module.exports = BackoffStrategy;

},{"events":40,"util":51}],40:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var objectCreate = Object.create || objectCreatePolyfill
var objectKeys = Object.keys || objectKeysPolyfill
var bind = Function.prototype.bind || functionBindPolyfill

function EventEmitter() {
  if (!this._events || !Object.prototype.hasOwnProperty.call(this, '_events')) {
    this._events = objectCreate(null);
    this._eventsCount = 0;
  }

  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
var defaultMaxListeners = 10;

var hasDefineProperty;
try {
  var o = {};
  if (Object.defineProperty) Object.defineProperty(o, 'x', { value: 0 });
  hasDefineProperty = o.x === 0;
} catch (err) { hasDefineProperty = false }
if (hasDefineProperty) {
  Object.defineProperty(EventEmitter, 'defaultMaxListeners', {
    enumerable: true,
    get: function() {
      return defaultMaxListeners;
    },
    set: function(arg) {
      // check whether the input is a positive number (whose value is zero or
      // greater and not a NaN).
      if (typeof arg !== 'number' || arg < 0 || arg !== arg)
        throw new TypeError('"defaultMaxListeners" must be a positive number');
      defaultMaxListeners = arg;
    }
  });
} else {
  EventEmitter.defaultMaxListeners = defaultMaxListeners;
}

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function setMaxListeners(n) {
  if (typeof n !== 'number' || n < 0 || isNaN(n))
    throw new TypeError('"n" argument must be a positive number');
  this._maxListeners = n;
  return this;
};

function $getMaxListeners(that) {
  if (that._maxListeners === undefined)
    return EventEmitter.defaultMaxListeners;
  return that._maxListeners;
}

EventEmitter.prototype.getMaxListeners = function getMaxListeners() {
  return $getMaxListeners(this);
};

// These standalone emit* functions are used to optimize calling of event
// handlers for fast cases because emit() itself often has a variable number of
// arguments and can be deoptimized because of that. These functions always have
// the same number of arguments and thus do not get deoptimized, so the code
// inside them can execute faster.
function emitNone(handler, isFn, self) {
  if (isFn)
    handler.call(self);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].call(self);
  }
}
function emitOne(handler, isFn, self, arg1) {
  if (isFn)
    handler.call(self, arg1);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].call(self, arg1);
  }
}
function emitTwo(handler, isFn, self, arg1, arg2) {
  if (isFn)
    handler.call(self, arg1, arg2);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].call(self, arg1, arg2);
  }
}
function emitThree(handler, isFn, self, arg1, arg2, arg3) {
  if (isFn)
    handler.call(self, arg1, arg2, arg3);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].call(self, arg1, arg2, arg3);
  }
}

function emitMany(handler, isFn, self, args) {
  if (isFn)
    handler.apply(self, args);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].apply(self, args);
  }
}

EventEmitter.prototype.emit = function emit(type) {
  var er, handler, len, args, i, events;
  var doError = (type === 'error');

  events = this._events;
  if (events)
    doError = (doError && events.error == null);
  else if (!doError)
    return false;

  // If there is no 'error' event listener then throw.
  if (doError) {
    if (arguments.length > 1)
      er = arguments[1];
    if (er instanceof Error) {
      throw er; // Unhandled 'error' event
    } else {
      // At least give some kind of context to the user
      var err = new Error('Unhandled "error" event. (' + er + ')');
      err.context = er;
      throw err;
    }
    return false;
  }

  handler = events[type];

  if (!handler)
    return false;

  var isFn = typeof handler === 'function';
  len = arguments.length;
  switch (len) {
      // fast cases
    case 1:
      emitNone(handler, isFn, this);
      break;
    case 2:
      emitOne(handler, isFn, this, arguments[1]);
      break;
    case 3:
      emitTwo(handler, isFn, this, arguments[1], arguments[2]);
      break;
    case 4:
      emitThree(handler, isFn, this, arguments[1], arguments[2], arguments[3]);
      break;
      // slower
    default:
      args = new Array(len - 1);
      for (i = 1; i < len; i++)
        args[i - 1] = arguments[i];
      emitMany(handler, isFn, this, args);
  }

  return true;
};

function _addListener(target, type, listener, prepend) {
  var m;
  var events;
  var existing;

  if (typeof listener !== 'function')
    throw new TypeError('"listener" argument must be a function');

  events = target._events;
  if (!events) {
    events = target._events = objectCreate(null);
    target._eventsCount = 0;
  } else {
    // To avoid recursion in the case that type === "newListener"! Before
    // adding it to the listeners, first emit "newListener".
    if (events.newListener) {
      target.emit('newListener', type,
          listener.listener ? listener.listener : listener);

      // Re-assign `events` because a newListener handler could have caused the
      // this._events to be assigned to a new object
      events = target._events;
    }
    existing = events[type];
  }

  if (!existing) {
    // Optimize the case of one listener. Don't need the extra array object.
    existing = events[type] = listener;
    ++target._eventsCount;
  } else {
    if (typeof existing === 'function') {
      // Adding the second element, need to change to array.
      existing = events[type] =
          prepend ? [listener, existing] : [existing, listener];
    } else {
      // If we've already got an array, just append.
      if (prepend) {
        existing.unshift(listener);
      } else {
        existing.push(listener);
      }
    }

    // Check for listener leak
    if (!existing.warned) {
      m = $getMaxListeners(target);
      if (m && m > 0 && existing.length > m) {
        existing.warned = true;
        var w = new Error('Possible EventEmitter memory leak detected. ' +
            existing.length + ' "' + String(type) + '" listeners ' +
            'added. Use emitter.setMaxListeners() to ' +
            'increase limit.');
        w.name = 'MaxListenersExceededWarning';
        w.emitter = target;
        w.type = type;
        w.count = existing.length;
        if (typeof console === 'object' && console.warn) {
          console.warn('%s: %s', w.name, w.message);
        }
      }
    }
  }

  return target;
}

EventEmitter.prototype.addListener = function addListener(type, listener) {
  return _addListener(this, type, listener, false);
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.prependListener =
    function prependListener(type, listener) {
      return _addListener(this, type, listener, true);
    };

function onceWrapper() {
  if (!this.fired) {
    this.target.removeListener(this.type, this.wrapFn);
    this.fired = true;
    switch (arguments.length) {
      case 0:
        return this.listener.call(this.target);
      case 1:
        return this.listener.call(this.target, arguments[0]);
      case 2:
        return this.listener.call(this.target, arguments[0], arguments[1]);
      case 3:
        return this.listener.call(this.target, arguments[0], arguments[1],
            arguments[2]);
      default:
        var args = new Array(arguments.length);
        for (var i = 0; i < args.length; ++i)
          args[i] = arguments[i];
        this.listener.apply(this.target, args);
    }
  }
}

function _onceWrap(target, type, listener) {
  var state = { fired: false, wrapFn: undefined, target: target, type: type, listener: listener };
  var wrapped = bind.call(onceWrapper, state);
  wrapped.listener = listener;
  state.wrapFn = wrapped;
  return wrapped;
}

EventEmitter.prototype.once = function once(type, listener) {
  if (typeof listener !== 'function')
    throw new TypeError('"listener" argument must be a function');
  this.on(type, _onceWrap(this, type, listener));
  return this;
};

EventEmitter.prototype.prependOnceListener =
    function prependOnceListener(type, listener) {
      if (typeof listener !== 'function')
        throw new TypeError('"listener" argument must be a function');
      this.prependListener(type, _onceWrap(this, type, listener));
      return this;
    };

// Emits a 'removeListener' event if and only if the listener was removed.
EventEmitter.prototype.removeListener =
    function removeListener(type, listener) {
      var list, events, position, i, originalListener;

      if (typeof listener !== 'function')
        throw new TypeError('"listener" argument must be a function');

      events = this._events;
      if (!events)
        return this;

      list = events[type];
      if (!list)
        return this;

      if (list === listener || list.listener === listener) {
        if (--this._eventsCount === 0)
          this._events = objectCreate(null);
        else {
          delete events[type];
          if (events.removeListener)
            this.emit('removeListener', type, list.listener || listener);
        }
      } else if (typeof list !== 'function') {
        position = -1;

        for (i = list.length - 1; i >= 0; i--) {
          if (list[i] === listener || list[i].listener === listener) {
            originalListener = list[i].listener;
            position = i;
            break;
          }
        }

        if (position < 0)
          return this;

        if (position === 0)
          list.shift();
        else
          spliceOne(list, position);

        if (list.length === 1)
          events[type] = list[0];

        if (events.removeListener)
          this.emit('removeListener', type, originalListener || listener);
      }

      return this;
    };

EventEmitter.prototype.removeAllListeners =
    function removeAllListeners(type) {
      var listeners, events, i;

      events = this._events;
      if (!events)
        return this;

      // not listening for removeListener, no need to emit
      if (!events.removeListener) {
        if (arguments.length === 0) {
          this._events = objectCreate(null);
          this._eventsCount = 0;
        } else if (events[type]) {
          if (--this._eventsCount === 0)
            this._events = objectCreate(null);
          else
            delete events[type];
        }
        return this;
      }

      // emit removeListener for all listeners on all events
      if (arguments.length === 0) {
        var keys = objectKeys(events);
        var key;
        for (i = 0; i < keys.length; ++i) {
          key = keys[i];
          if (key === 'removeListener') continue;
          this.removeAllListeners(key);
        }
        this.removeAllListeners('removeListener');
        this._events = objectCreate(null);
        this._eventsCount = 0;
        return this;
      }

      listeners = events[type];

      if (typeof listeners === 'function') {
        this.removeListener(type, listeners);
      } else if (listeners) {
        // LIFO order
        for (i = listeners.length - 1; i >= 0; i--) {
          this.removeListener(type, listeners[i]);
        }
      }

      return this;
    };

function _listeners(target, type, unwrap) {
  var events = target._events;

  if (!events)
    return [];

  var evlistener = events[type];
  if (!evlistener)
    return [];

  if (typeof evlistener === 'function')
    return unwrap ? [evlistener.listener || evlistener] : [evlistener];

  return unwrap ? unwrapListeners(evlistener) : arrayClone(evlistener, evlistener.length);
}

EventEmitter.prototype.listeners = function listeners(type) {
  return _listeners(this, type, true);
};

EventEmitter.prototype.rawListeners = function rawListeners(type) {
  return _listeners(this, type, false);
};

EventEmitter.listenerCount = function(emitter, type) {
  if (typeof emitter.listenerCount === 'function') {
    return emitter.listenerCount(type);
  } else {
    return listenerCount.call(emitter, type);
  }
};

EventEmitter.prototype.listenerCount = listenerCount;
function listenerCount(type) {
  var events = this._events;

  if (events) {
    var evlistener = events[type];

    if (typeof evlistener === 'function') {
      return 1;
    } else if (evlistener) {
      return evlistener.length;
    }
  }

  return 0;
}

EventEmitter.prototype.eventNames = function eventNames() {
  return this._eventsCount > 0 ? Reflect.ownKeys(this._events) : [];
};

// About 1.5x faster than the two-arg version of Array#splice().
function spliceOne(list, index) {
  for (var i = index, k = i + 1, n = list.length; k < n; i += 1, k += 1)
    list[i] = list[k];
  list.pop();
}

function arrayClone(arr, n) {
  var copy = new Array(n);
  for (var i = 0; i < n; ++i)
    copy[i] = arr[i];
  return copy;
}

function unwrapListeners(arr) {
  var ret = new Array(arr.length);
  for (var i = 0; i < ret.length; ++i) {
    ret[i] = arr[i].listener || arr[i];
  }
  return ret;
}

function objectCreatePolyfill(proto) {
  var F = function() {};
  F.prototype = proto;
  return new F;
}
function objectKeysPolyfill(obj) {
  var keys = [];
  for (var k in obj) if (Object.prototype.hasOwnProperty.call(obj, k)) {
    keys.push(k);
  }
  return k;
}
function functionBindPolyfill(context) {
  var fn = this;
  return function () {
    return fn.apply(context, arguments);
  };
}

},{}],41:[function(require,module,exports){
if (typeof Object.create === 'function') {
  // implementation from standard node.js 'util' module
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  };
} else {
  // old school shim for old browsers
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    var TempCtor = function () {}
    TempCtor.prototype = superCtor.prototype
    ctor.prototype = new TempCtor()
    ctor.prototype.constructor = ctor
  }
}

},{}],42:[function(require,module,exports){
/*
 * Copyright (c) 2012 Mathieu Turcotte
 * Licensed under the MIT license.
 */

module.exports = require('./lib/checks');
},{"./lib/checks":43}],43:[function(require,module,exports){
/*
 * Copyright (c) 2012 Mathieu Turcotte
 * Licensed under the MIT license.
 */

var util = require('util');

var errors = module.exports = require('./errors');

function failCheck(ExceptionConstructor, callee, messageFormat, formatArgs) {
    messageFormat = messageFormat || '';
    var message = util.format.apply(this, [messageFormat].concat(formatArgs));
    var error = new ExceptionConstructor(message);
    Error.captureStackTrace(error, callee);
    throw error;
}

function failArgumentCheck(callee, message, formatArgs) {
    failCheck(errors.IllegalArgumentError, callee, message, formatArgs);
}

function failStateCheck(callee, message, formatArgs) {
    failCheck(errors.IllegalStateError, callee, message, formatArgs);
}

module.exports.checkArgument = function(value, message) {
    if (!value) {
        failArgumentCheck(arguments.callee, message,
            Array.prototype.slice.call(arguments, 2));
    }
};

module.exports.checkState = function(value, message) {
    if (!value) {
        failStateCheck(arguments.callee, message,
            Array.prototype.slice.call(arguments, 2));
    }
};

module.exports.checkIsDef = function(value, message) {
    if (value !== undefined) {
        return value;
    }

    failArgumentCheck(arguments.callee, message ||
        'Expected value to be defined but was undefined.',
        Array.prototype.slice.call(arguments, 2));
};

module.exports.checkIsDefAndNotNull = function(value, message) {
    // Note that undefined == null.
    if (value != null) {
        return value;
    }

    failArgumentCheck(arguments.callee, message ||
        'Expected value to be defined and not null but got "' +
        typeOf(value) + '".', Array.prototype.slice.call(arguments, 2));
};

// Fixed version of the typeOf operator which returns 'null' for null values
// and 'array' for arrays.
function typeOf(value) {
    var s = typeof value;
    if (s == 'object') {
        if (!value) {
            return 'null';
        } else if (value instanceof Array) {
            return 'array';
        }
    }
    return s;
}

function typeCheck(expect) {
    return function(value, message) {
        var type = typeOf(value);

        if (type == expect) {
            return value;
        }

        failArgumentCheck(arguments.callee, message ||
            'Expected "' + expect + '" but got "' + type + '".',
            Array.prototype.slice.call(arguments, 2));
    };
}

module.exports.checkIsString = typeCheck('string');
module.exports.checkIsArray = typeCheck('array');
module.exports.checkIsNumber = typeCheck('number');
module.exports.checkIsBoolean = typeCheck('boolean');
module.exports.checkIsFunction = typeCheck('function');
module.exports.checkIsObject = typeCheck('object');

},{"./errors":44,"util":51}],44:[function(require,module,exports){
/*
 * Copyright (c) 2012 Mathieu Turcotte
 * Licensed under the MIT license.
 */

var util = require('util');

function IllegalArgumentError(message) {
    Error.call(this, message);
    this.message = message;
}
util.inherits(IllegalArgumentError, Error);

IllegalArgumentError.prototype.name = 'IllegalArgumentError';

function IllegalStateError(message) {
    Error.call(this, message);
    this.message = message;
}
util.inherits(IllegalStateError, Error);

IllegalStateError.prototype.name = 'IllegalStateError';

module.exports.IllegalStateError = IllegalStateError;
module.exports.IllegalArgumentError = IllegalArgumentError;
},{"util":51}],45:[function(require,module,exports){
// shim for using process in browser
var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

function defaultSetTimout() {
    throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout () {
    throw new Error('clearTimeout has not been defined');
}
(function () {
    try {
        if (typeof setTimeout === 'function') {
            cachedSetTimeout = setTimeout;
        } else {
            cachedSetTimeout = defaultSetTimout;
        }
    } catch (e) {
        cachedSetTimeout = defaultSetTimout;
    }
    try {
        if (typeof clearTimeout === 'function') {
            cachedClearTimeout = clearTimeout;
        } else {
            cachedClearTimeout = defaultClearTimeout;
        }
    } catch (e) {
        cachedClearTimeout = defaultClearTimeout;
    }
} ())
function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        //normal enviroments in sane situations
        return setTimeout(fun, 0);
    }
    // if setTimeout wasn't available but was latter defined
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedSetTimeout(fun, 0);
    } catch(e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
        } catch(e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
        }
    }


}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        //normal enviroments in sane situations
        return clearTimeout(marker);
    }
    // if clearTimeout wasn't available but was latter defined
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedClearTimeout(marker);
    } catch (e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
        } catch (e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
        }
    }



}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;
process.prependListener = noop;
process.prependOnceListener = noop;

process.listeners = function (name) { return [] }

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],46:[function(require,module,exports){
/**
 * Copyright (c) 2014-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

// This method of obtaining a reference to the global object needs to be
// kept identical to the way it is obtained in runtime.js
var g = (function() { return this })() || Function("return this")();

// Use `getOwnPropertyNames` because not all browsers support calling
// `hasOwnProperty` on the global `self` object in a worker. See #183.
var hadRuntime = g.regeneratorRuntime &&
  Object.getOwnPropertyNames(g).indexOf("regeneratorRuntime") >= 0;

// Save the old regeneratorRuntime in case it needs to be restored later.
var oldRuntime = hadRuntime && g.regeneratorRuntime;

// Force reevalutation of runtime.js.
g.regeneratorRuntime = undefined;

module.exports = require("./runtime");

if (hadRuntime) {
  // Restore the original runtime.
  g.regeneratorRuntime = oldRuntime;
} else {
  // Remove the global property added by runtime.js.
  try {
    delete g.regeneratorRuntime;
  } catch(e) {
    g.regeneratorRuntime = undefined;
  }
}

},{"./runtime":47}],47:[function(require,module,exports){
/**
 * Copyright (c) 2014-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

!(function(global) {
  "use strict";

  var Op = Object.prototype;
  var hasOwn = Op.hasOwnProperty;
  var undefined; // More compressible than void 0.
  var $Symbol = typeof Symbol === "function" ? Symbol : {};
  var iteratorSymbol = $Symbol.iterator || "@@iterator";
  var asyncIteratorSymbol = $Symbol.asyncIterator || "@@asyncIterator";
  var toStringTagSymbol = $Symbol.toStringTag || "@@toStringTag";

  var inModule = typeof module === "object";
  var runtime = global.regeneratorRuntime;
  if (runtime) {
    if (inModule) {
      // If regeneratorRuntime is defined globally and we're in a module,
      // make the exports object identical to regeneratorRuntime.
      module.exports = runtime;
    }
    // Don't bother evaluating the rest of this file if the runtime was
    // already defined globally.
    return;
  }

  // Define the runtime globally (as expected by generated code) as either
  // module.exports (if we're in a module) or a new, empty object.
  runtime = global.regeneratorRuntime = inModule ? module.exports : {};

  function wrap(innerFn, outerFn, self, tryLocsList) {
    // If outerFn provided and outerFn.prototype is a Generator, then outerFn.prototype instanceof Generator.
    var protoGenerator = outerFn && outerFn.prototype instanceof Generator ? outerFn : Generator;
    var generator = Object.create(protoGenerator.prototype);
    var context = new Context(tryLocsList || []);

    // The ._invoke method unifies the implementations of the .next,
    // .throw, and .return methods.
    generator._invoke = makeInvokeMethod(innerFn, self, context);

    return generator;
  }
  runtime.wrap = wrap;

  // Try/catch helper to minimize deoptimizations. Returns a completion
  // record like context.tryEntries[i].completion. This interface could
  // have been (and was previously) designed to take a closure to be
  // invoked without arguments, but in all the cases we care about we
  // already have an existing method we want to call, so there's no need
  // to create a new function object. We can even get away with assuming
  // the method takes exactly one argument, since that happens to be true
  // in every case, so we don't have to touch the arguments object. The
  // only additional allocation required is the completion record, which
  // has a stable shape and so hopefully should be cheap to allocate.
  function tryCatch(fn, obj, arg) {
    try {
      return { type: "normal", arg: fn.call(obj, arg) };
    } catch (err) {
      return { type: "throw", arg: err };
    }
  }

  var GenStateSuspendedStart = "suspendedStart";
  var GenStateSuspendedYield = "suspendedYield";
  var GenStateExecuting = "executing";
  var GenStateCompleted = "completed";

  // Returning this object from the innerFn has the same effect as
  // breaking out of the dispatch switch statement.
  var ContinueSentinel = {};

  // Dummy constructor functions that we use as the .constructor and
  // .constructor.prototype properties for functions that return Generator
  // objects. For full spec compliance, you may wish to configure your
  // minifier not to mangle the names of these two functions.
  function Generator() {}
  function GeneratorFunction() {}
  function GeneratorFunctionPrototype() {}

  // This is a polyfill for %IteratorPrototype% for environments that
  // don't natively support it.
  var IteratorPrototype = {};
  IteratorPrototype[iteratorSymbol] = function () {
    return this;
  };

  var getProto = Object.getPrototypeOf;
  var NativeIteratorPrototype = getProto && getProto(getProto(values([])));
  if (NativeIteratorPrototype &&
      NativeIteratorPrototype !== Op &&
      hasOwn.call(NativeIteratorPrototype, iteratorSymbol)) {
    // This environment has a native %IteratorPrototype%; use it instead
    // of the polyfill.
    IteratorPrototype = NativeIteratorPrototype;
  }

  var Gp = GeneratorFunctionPrototype.prototype =
    Generator.prototype = Object.create(IteratorPrototype);
  GeneratorFunction.prototype = Gp.constructor = GeneratorFunctionPrototype;
  GeneratorFunctionPrototype.constructor = GeneratorFunction;
  GeneratorFunctionPrototype[toStringTagSymbol] =
    GeneratorFunction.displayName = "GeneratorFunction";

  // Helper for defining the .next, .throw, and .return methods of the
  // Iterator interface in terms of a single ._invoke method.
  function defineIteratorMethods(prototype) {
    ["next", "throw", "return"].forEach(function(method) {
      prototype[method] = function(arg) {
        return this._invoke(method, arg);
      };
    });
  }

  runtime.isGeneratorFunction = function(genFun) {
    var ctor = typeof genFun === "function" && genFun.constructor;
    return ctor
      ? ctor === GeneratorFunction ||
        // For the native GeneratorFunction constructor, the best we can
        // do is to check its .name property.
        (ctor.displayName || ctor.name) === "GeneratorFunction"
      : false;
  };

  runtime.mark = function(genFun) {
    if (Object.setPrototypeOf) {
      Object.setPrototypeOf(genFun, GeneratorFunctionPrototype);
    } else {
      genFun.__proto__ = GeneratorFunctionPrototype;
      if (!(toStringTagSymbol in genFun)) {
        genFun[toStringTagSymbol] = "GeneratorFunction";
      }
    }
    genFun.prototype = Object.create(Gp);
    return genFun;
  };

  // Within the body of any async function, `await x` is transformed to
  // `yield regeneratorRuntime.awrap(x)`, so that the runtime can test
  // `hasOwn.call(value, "__await")` to determine if the yielded value is
  // meant to be awaited.
  runtime.awrap = function(arg) {
    return { __await: arg };
  };

  function AsyncIterator(generator) {
    function invoke(method, arg, resolve, reject) {
      var record = tryCatch(generator[method], generator, arg);
      if (record.type === "throw") {
        reject(record.arg);
      } else {
        var result = record.arg;
        var value = result.value;
        if (value &&
            typeof value === "object" &&
            hasOwn.call(value, "__await")) {
          return Promise.resolve(value.__await).then(function(value) {
            invoke("next", value, resolve, reject);
          }, function(err) {
            invoke("throw", err, resolve, reject);
          });
        }

        return Promise.resolve(value).then(function(unwrapped) {
          // When a yielded Promise is resolved, its final value becomes
          // the .value of the Promise<{value,done}> result for the
          // current iteration. If the Promise is rejected, however, the
          // result for this iteration will be rejected with the same
          // reason. Note that rejections of yielded Promises are not
          // thrown back into the generator function, as is the case
          // when an awaited Promise is rejected. This difference in
          // behavior between yield and await is important, because it
          // allows the consumer to decide what to do with the yielded
          // rejection (swallow it and continue, manually .throw it back
          // into the generator, abandon iteration, whatever). With
          // await, by contrast, there is no opportunity to examine the
          // rejection reason outside the generator function, so the
          // only option is to throw it from the await expression, and
          // let the generator function handle the exception.
          result.value = unwrapped;
          resolve(result);
        }, reject);
      }
    }

    var previousPromise;

    function enqueue(method, arg) {
      function callInvokeWithMethodAndArg() {
        return new Promise(function(resolve, reject) {
          invoke(method, arg, resolve, reject);
        });
      }

      return previousPromise =
        // If enqueue has been called before, then we want to wait until
        // all previous Promises have been resolved before calling invoke,
        // so that results are always delivered in the correct order. If
        // enqueue has not been called before, then it is important to
        // call invoke immediately, without waiting on a callback to fire,
        // so that the async generator function has the opportunity to do
        // any necessary setup in a predictable way. This predictability
        // is why the Promise constructor synchronously invokes its
        // executor callback, and why async functions synchronously
        // execute code before the first await. Since we implement simple
        // async functions in terms of async generators, it is especially
        // important to get this right, even though it requires care.
        previousPromise ? previousPromise.then(
          callInvokeWithMethodAndArg,
          // Avoid propagating failures to Promises returned by later
          // invocations of the iterator.
          callInvokeWithMethodAndArg
        ) : callInvokeWithMethodAndArg();
    }

    // Define the unified helper method that is used to implement .next,
    // .throw, and .return (see defineIteratorMethods).
    this._invoke = enqueue;
  }

  defineIteratorMethods(AsyncIterator.prototype);
  AsyncIterator.prototype[asyncIteratorSymbol] = function () {
    return this;
  };
  runtime.AsyncIterator = AsyncIterator;

  // Note that simple async functions are implemented on top of
  // AsyncIterator objects; they just return a Promise for the value of
  // the final result produced by the iterator.
  runtime.async = function(innerFn, outerFn, self, tryLocsList) {
    var iter = new AsyncIterator(
      wrap(innerFn, outerFn, self, tryLocsList)
    );

    return runtime.isGeneratorFunction(outerFn)
      ? iter // If outerFn is a generator, return the full iterator.
      : iter.next().then(function(result) {
          return result.done ? result.value : iter.next();
        });
  };

  function makeInvokeMethod(innerFn, self, context) {
    var state = GenStateSuspendedStart;

    return function invoke(method, arg) {
      if (state === GenStateExecuting) {
        throw new Error("Generator is already running");
      }

      if (state === GenStateCompleted) {
        if (method === "throw") {
          throw arg;
        }

        // Be forgiving, per 25.3.3.3.3 of the spec:
        // https://people.mozilla.org/~jorendorff/es6-draft.html#sec-generatorresume
        return doneResult();
      }

      context.method = method;
      context.arg = arg;

      while (true) {
        var delegate = context.delegate;
        if (delegate) {
          var delegateResult = maybeInvokeDelegate(delegate, context);
          if (delegateResult) {
            if (delegateResult === ContinueSentinel) continue;
            return delegateResult;
          }
        }

        if (context.method === "next") {
          // Setting context._sent for legacy support of Babel's
          // function.sent implementation.
          context.sent = context._sent = context.arg;

        } else if (context.method === "throw") {
          if (state === GenStateSuspendedStart) {
            state = GenStateCompleted;
            throw context.arg;
          }

          context.dispatchException(context.arg);

        } else if (context.method === "return") {
          context.abrupt("return", context.arg);
        }

        state = GenStateExecuting;

        var record = tryCatch(innerFn, self, context);
        if (record.type === "normal") {
          // If an exception is thrown from innerFn, we leave state ===
          // GenStateExecuting and loop back for another invocation.
          state = context.done
            ? GenStateCompleted
            : GenStateSuspendedYield;

          if (record.arg === ContinueSentinel) {
            continue;
          }

          return {
            value: record.arg,
            done: context.done
          };

        } else if (record.type === "throw") {
          state = GenStateCompleted;
          // Dispatch the exception by looping back around to the
          // context.dispatchException(context.arg) call above.
          context.method = "throw";
          context.arg = record.arg;
        }
      }
    };
  }

  // Call delegate.iterator[context.method](context.arg) and handle the
  // result, either by returning a { value, done } result from the
  // delegate iterator, or by modifying context.method and context.arg,
  // setting context.delegate to null, and returning the ContinueSentinel.
  function maybeInvokeDelegate(delegate, context) {
    var method = delegate.iterator[context.method];
    if (method === undefined) {
      // A .throw or .return when the delegate iterator has no .throw
      // method always terminates the yield* loop.
      context.delegate = null;

      if (context.method === "throw") {
        if (delegate.iterator.return) {
          // If the delegate iterator has a return method, give it a
          // chance to clean up.
          context.method = "return";
          context.arg = undefined;
          maybeInvokeDelegate(delegate, context);

          if (context.method === "throw") {
            // If maybeInvokeDelegate(context) changed context.method from
            // "return" to "throw", let that override the TypeError below.
            return ContinueSentinel;
          }
        }

        context.method = "throw";
        context.arg = new TypeError(
          "The iterator does not provide a 'throw' method");
      }

      return ContinueSentinel;
    }

    var record = tryCatch(method, delegate.iterator, context.arg);

    if (record.type === "throw") {
      context.method = "throw";
      context.arg = record.arg;
      context.delegate = null;
      return ContinueSentinel;
    }

    var info = record.arg;

    if (! info) {
      context.method = "throw";
      context.arg = new TypeError("iterator result is not an object");
      context.delegate = null;
      return ContinueSentinel;
    }

    if (info.done) {
      // Assign the result of the finished delegate to the temporary
      // variable specified by delegate.resultName (see delegateYield).
      context[delegate.resultName] = info.value;

      // Resume execution at the desired location (see delegateYield).
      context.next = delegate.nextLoc;

      // If context.method was "throw" but the delegate handled the
      // exception, let the outer generator proceed normally. If
      // context.method was "next", forget context.arg since it has been
      // "consumed" by the delegate iterator. If context.method was
      // "return", allow the original .return call to continue in the
      // outer generator.
      if (context.method !== "return") {
        context.method = "next";
        context.arg = undefined;
      }

    } else {
      // Re-yield the result returned by the delegate method.
      return info;
    }

    // The delegate iterator is finished, so forget it and continue with
    // the outer generator.
    context.delegate = null;
    return ContinueSentinel;
  }

  // Define Generator.prototype.{next,throw,return} in terms of the
  // unified ._invoke helper method.
  defineIteratorMethods(Gp);

  Gp[toStringTagSymbol] = "Generator";

  // A Generator should always return itself as the iterator object when the
  // @@iterator function is called on it. Some browsers' implementations of the
  // iterator prototype chain incorrectly implement this, causing the Generator
  // object to not be returned from this call. This ensures that doesn't happen.
  // See https://github.com/facebook/regenerator/issues/274 for more details.
  Gp[iteratorSymbol] = function() {
    return this;
  };

  Gp.toString = function() {
    return "[object Generator]";
  };

  function pushTryEntry(locs) {
    var entry = { tryLoc: locs[0] };

    if (1 in locs) {
      entry.catchLoc = locs[1];
    }

    if (2 in locs) {
      entry.finallyLoc = locs[2];
      entry.afterLoc = locs[3];
    }

    this.tryEntries.push(entry);
  }

  function resetTryEntry(entry) {
    var record = entry.completion || {};
    record.type = "normal";
    delete record.arg;
    entry.completion = record;
  }

  function Context(tryLocsList) {
    // The root entry object (effectively a try statement without a catch
    // or a finally block) gives us a place to store values thrown from
    // locations where there is no enclosing try statement.
    this.tryEntries = [{ tryLoc: "root" }];
    tryLocsList.forEach(pushTryEntry, this);
    this.reset(true);
  }

  runtime.keys = function(object) {
    var keys = [];
    for (var key in object) {
      keys.push(key);
    }
    keys.reverse();

    // Rather than returning an object with a next method, we keep
    // things simple and return the next function itself.
    return function next() {
      while (keys.length) {
        var key = keys.pop();
        if (key in object) {
          next.value = key;
          next.done = false;
          return next;
        }
      }

      // To avoid creating an additional object, we just hang the .value
      // and .done properties off the next function object itself. This
      // also ensures that the minifier will not anonymize the function.
      next.done = true;
      return next;
    };
  };

  function values(iterable) {
    if (iterable) {
      var iteratorMethod = iterable[iteratorSymbol];
      if (iteratorMethod) {
        return iteratorMethod.call(iterable);
      }

      if (typeof iterable.next === "function") {
        return iterable;
      }

      if (!isNaN(iterable.length)) {
        var i = -1, next = function next() {
          while (++i < iterable.length) {
            if (hasOwn.call(iterable, i)) {
              next.value = iterable[i];
              next.done = false;
              return next;
            }
          }

          next.value = undefined;
          next.done = true;

          return next;
        };

        return next.next = next;
      }
    }

    // Return an iterator with no values.
    return { next: doneResult };
  }
  runtime.values = values;

  function doneResult() {
    return { value: undefined, done: true };
  }

  Context.prototype = {
    constructor: Context,

    reset: function(skipTempReset) {
      this.prev = 0;
      this.next = 0;
      // Resetting context._sent for legacy support of Babel's
      // function.sent implementation.
      this.sent = this._sent = undefined;
      this.done = false;
      this.delegate = null;

      this.method = "next";
      this.arg = undefined;

      this.tryEntries.forEach(resetTryEntry);

      if (!skipTempReset) {
        for (var name in this) {
          // Not sure about the optimal order of these conditions:
          if (name.charAt(0) === "t" &&
              hasOwn.call(this, name) &&
              !isNaN(+name.slice(1))) {
            this[name] = undefined;
          }
        }
      }
    },

    stop: function() {
      this.done = true;

      var rootEntry = this.tryEntries[0];
      var rootRecord = rootEntry.completion;
      if (rootRecord.type === "throw") {
        throw rootRecord.arg;
      }

      return this.rval;
    },

    dispatchException: function(exception) {
      if (this.done) {
        throw exception;
      }

      var context = this;
      function handle(loc, caught) {
        record.type = "throw";
        record.arg = exception;
        context.next = loc;

        if (caught) {
          // If the dispatched exception was caught by a catch block,
          // then let that catch block handle the exception normally.
          context.method = "next";
          context.arg = undefined;
        }

        return !! caught;
      }

      for (var i = this.tryEntries.length - 1; i >= 0; --i) {
        var entry = this.tryEntries[i];
        var record = entry.completion;

        if (entry.tryLoc === "root") {
          // Exception thrown outside of any try block that could handle
          // it, so set the completion value of the entire function to
          // throw the exception.
          return handle("end");
        }

        if (entry.tryLoc <= this.prev) {
          var hasCatch = hasOwn.call(entry, "catchLoc");
          var hasFinally = hasOwn.call(entry, "finallyLoc");

          if (hasCatch && hasFinally) {
            if (this.prev < entry.catchLoc) {
              return handle(entry.catchLoc, true);
            } else if (this.prev < entry.finallyLoc) {
              return handle(entry.finallyLoc);
            }

          } else if (hasCatch) {
            if (this.prev < entry.catchLoc) {
              return handle(entry.catchLoc, true);
            }

          } else if (hasFinally) {
            if (this.prev < entry.finallyLoc) {
              return handle(entry.finallyLoc);
            }

          } else {
            throw new Error("try statement without catch or finally");
          }
        }
      }
    },

    abrupt: function(type, arg) {
      for (var i = this.tryEntries.length - 1; i >= 0; --i) {
        var entry = this.tryEntries[i];
        if (entry.tryLoc <= this.prev &&
            hasOwn.call(entry, "finallyLoc") &&
            this.prev < entry.finallyLoc) {
          var finallyEntry = entry;
          break;
        }
      }

      if (finallyEntry &&
          (type === "break" ||
           type === "continue") &&
          finallyEntry.tryLoc <= arg &&
          arg <= finallyEntry.finallyLoc) {
        // Ignore the finally entry if control is not jumping to a
        // location outside the try/catch block.
        finallyEntry = null;
      }

      var record = finallyEntry ? finallyEntry.completion : {};
      record.type = type;
      record.arg = arg;

      if (finallyEntry) {
        this.method = "next";
        this.next = finallyEntry.finallyLoc;
        return ContinueSentinel;
      }

      return this.complete(record);
    },

    complete: function(record, afterLoc) {
      if (record.type === "throw") {
        throw record.arg;
      }

      if (record.type === "break" ||
          record.type === "continue") {
        this.next = record.arg;
      } else if (record.type === "return") {
        this.rval = this.arg = record.arg;
        this.method = "return";
        this.next = "end";
      } else if (record.type === "normal" && afterLoc) {
        this.next = afterLoc;
      }

      return ContinueSentinel;
    },

    finish: function(finallyLoc) {
      for (var i = this.tryEntries.length - 1; i >= 0; --i) {
        var entry = this.tryEntries[i];
        if (entry.finallyLoc === finallyLoc) {
          this.complete(entry.completion, entry.afterLoc);
          resetTryEntry(entry);
          return ContinueSentinel;
        }
      }
    },

    "catch": function(tryLoc) {
      for (var i = this.tryEntries.length - 1; i >= 0; --i) {
        var entry = this.tryEntries[i];
        if (entry.tryLoc === tryLoc) {
          var record = entry.completion;
          if (record.type === "throw") {
            var thrown = record.arg;
            resetTryEntry(entry);
          }
          return thrown;
        }
      }

      // The context.catch method must only be called with a location
      // argument that corresponds to a known catch block.
      throw new Error("illegal catch attempt");
    },

    delegateYield: function(iterable, resultName, nextLoc) {
      this.delegate = {
        iterator: values(iterable),
        resultName: resultName,
        nextLoc: nextLoc
      };

      if (this.method === "next") {
        // Deliberately forget the last sent value so that we don't
        // accidentally pass it on to the delegate.
        this.arg = undefined;
      }

      return ContinueSentinel;
    }
  };
})(
  // In sloppy mode, unbound `this` refers to the global object, fallback to
  // Function constructor if we're in global strict mode. That is sadly a form
  // of indirect eval which violates Content Security Policy.
  (function() { return this })() || Function("return this")()
);

},{}],48:[function(require,module,exports){
/*
 *  Copyright (c) 2017 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */
 /* eslint-env node */
'use strict';

var SDPUtils = require('sdp');

function fixStatsType(stat) {
  return {
    inboundrtp: 'inbound-rtp',
    outboundrtp: 'outbound-rtp',
    candidatepair: 'candidate-pair',
    localcandidate: 'local-candidate',
    remotecandidate: 'remote-candidate'
  }[stat.type] || stat.type;
}

function writeMediaSection(transceiver, caps, type, stream, dtlsRole) {
  var sdp = SDPUtils.writeRtpDescription(transceiver.kind, caps);

  // Map ICE parameters (ufrag, pwd) to SDP.
  sdp += SDPUtils.writeIceParameters(
      transceiver.iceGatherer.getLocalParameters());

  // Map DTLS parameters to SDP.
  sdp += SDPUtils.writeDtlsParameters(
      transceiver.dtlsTransport.getLocalParameters(),
      type === 'offer' ? 'actpass' : dtlsRole || 'active');

  sdp += 'a=mid:' + transceiver.mid + '\r\n';

  if (transceiver.rtpSender && transceiver.rtpReceiver) {
    sdp += 'a=sendrecv\r\n';
  } else if (transceiver.rtpSender) {
    sdp += 'a=sendonly\r\n';
  } else if (transceiver.rtpReceiver) {
    sdp += 'a=recvonly\r\n';
  } else {
    sdp += 'a=inactive\r\n';
  }

  if (transceiver.rtpSender) {
    var trackId = transceiver.rtpSender._initialTrackId ||
        transceiver.rtpSender.track.id;
    transceiver.rtpSender._initialTrackId = trackId;
    // spec.
    var msid = 'msid:' + (stream ? stream.id : '-') + ' ' +
        trackId + '\r\n';
    sdp += 'a=' + msid;
    // for Chrome. Legacy should no longer be required.
    sdp += 'a=ssrc:' + transceiver.sendEncodingParameters[0].ssrc +
        ' ' + msid;

    // RTX
    if (transceiver.sendEncodingParameters[0].rtx) {
      sdp += 'a=ssrc:' + transceiver.sendEncodingParameters[0].rtx.ssrc +
          ' ' + msid;
      sdp += 'a=ssrc-group:FID ' +
          transceiver.sendEncodingParameters[0].ssrc + ' ' +
          transceiver.sendEncodingParameters[0].rtx.ssrc +
          '\r\n';
    }
  }
  // FIXME: this should be written by writeRtpDescription.
  sdp += 'a=ssrc:' + transceiver.sendEncodingParameters[0].ssrc +
      ' cname:' + SDPUtils.localCName + '\r\n';
  if (transceiver.rtpSender && transceiver.sendEncodingParameters[0].rtx) {
    sdp += 'a=ssrc:' + transceiver.sendEncodingParameters[0].rtx.ssrc +
        ' cname:' + SDPUtils.localCName + '\r\n';
  }
  return sdp;
}

// Edge does not like
// 1) stun: filtered after 14393 unless ?transport=udp is present
// 2) turn: that does not have all of turn:host:port?transport=udp
// 3) turn: with ipv6 addresses
// 4) turn: occurring muliple times
function filterIceServers(iceServers, edgeVersion) {
  var hasTurn = false;
  iceServers = JSON.parse(JSON.stringify(iceServers));
  return iceServers.filter(function(server) {
    if (server && (server.urls || server.url)) {
      var urls = server.urls || server.url;
      if (server.url && !server.urls) {
        console.warn('RTCIceServer.url is deprecated! Use urls instead.');
      }
      var isString = typeof urls === 'string';
      if (isString) {
        urls = [urls];
      }
      urls = urls.filter(function(url) {
        var validTurn = url.indexOf('turn:') === 0 &&
            url.indexOf('transport=udp') !== -1 &&
            url.indexOf('turn:[') === -1 &&
            !hasTurn;

        if (validTurn) {
          hasTurn = true;
          return true;
        }
        return url.indexOf('stun:') === 0 && edgeVersion >= 14393 &&
            url.indexOf('?transport=udp') === -1;
      });

      delete server.url;
      server.urls = isString ? urls[0] : urls;
      return !!urls.length;
    }
  });
}

// Determines the intersection of local and remote capabilities.
function getCommonCapabilities(localCapabilities, remoteCapabilities) {
  var commonCapabilities = {
    codecs: [],
    headerExtensions: [],
    fecMechanisms: []
  };

  var findCodecByPayloadType = function(pt, codecs) {
    pt = parseInt(pt, 10);
    for (var i = 0; i < codecs.length; i++) {
      if (codecs[i].payloadType === pt ||
          codecs[i].preferredPayloadType === pt) {
        return codecs[i];
      }
    }
  };

  var rtxCapabilityMatches = function(lRtx, rRtx, lCodecs, rCodecs) {
    var lCodec = findCodecByPayloadType(lRtx.parameters.apt, lCodecs);
    var rCodec = findCodecByPayloadType(rRtx.parameters.apt, rCodecs);
    return lCodec && rCodec &&
        lCodec.name.toLowerCase() === rCodec.name.toLowerCase();
  };

  localCapabilities.codecs.forEach(function(lCodec) {
    for (var i = 0; i < remoteCapabilities.codecs.length; i++) {
      var rCodec = remoteCapabilities.codecs[i];
      if (lCodec.name.toLowerCase() === rCodec.name.toLowerCase() &&
          lCodec.clockRate === rCodec.clockRate) {
        if (lCodec.name.toLowerCase() === 'rtx' &&
            lCodec.parameters && rCodec.parameters.apt) {
          // for RTX we need to find the local rtx that has a apt
          // which points to the same local codec as the remote one.
          if (!rtxCapabilityMatches(lCodec, rCodec,
              localCapabilities.codecs, remoteCapabilities.codecs)) {
            continue;
          }
        }
        rCodec = JSON.parse(JSON.stringify(rCodec)); // deepcopy
        // number of channels is the highest common number of channels
        rCodec.numChannels = Math.min(lCodec.numChannels,
            rCodec.numChannels);
        // push rCodec so we reply with offerer payload type
        commonCapabilities.codecs.push(rCodec);

        // determine common feedback mechanisms
        rCodec.rtcpFeedback = rCodec.rtcpFeedback.filter(function(fb) {
          for (var j = 0; j < lCodec.rtcpFeedback.length; j++) {
            if (lCodec.rtcpFeedback[j].type === fb.type &&
                lCodec.rtcpFeedback[j].parameter === fb.parameter) {
              return true;
            }
          }
          return false;
        });
        // FIXME: also need to determine .parameters
        //  see https://github.com/openpeer/ortc/issues/569
        break;
      }
    }
  });

  localCapabilities.headerExtensions.forEach(function(lHeaderExtension) {
    for (var i = 0; i < remoteCapabilities.headerExtensions.length;
         i++) {
      var rHeaderExtension = remoteCapabilities.headerExtensions[i];
      if (lHeaderExtension.uri === rHeaderExtension.uri) {
        commonCapabilities.headerExtensions.push(rHeaderExtension);
        break;
      }
    }
  });

  // FIXME: fecMechanisms
  return commonCapabilities;
}

// is action=setLocalDescription with type allowed in signalingState
function isActionAllowedInSignalingState(action, type, signalingState) {
  return {
    offer: {
      setLocalDescription: ['stable', 'have-local-offer'],
      setRemoteDescription: ['stable', 'have-remote-offer']
    },
    answer: {
      setLocalDescription: ['have-remote-offer', 'have-local-pranswer'],
      setRemoteDescription: ['have-local-offer', 'have-remote-pranswer']
    }
  }[type][action].indexOf(signalingState) !== -1;
}

function maybeAddCandidate(iceTransport, candidate) {
  // Edge's internal representation adds some fields therefore
  // not all fieldѕ are taken into account.
  var alreadyAdded = iceTransport.getRemoteCandidates()
      .find(function(remoteCandidate) {
        return candidate.foundation === remoteCandidate.foundation &&
            candidate.ip === remoteCandidate.ip &&
            candidate.port === remoteCandidate.port &&
            candidate.priority === remoteCandidate.priority &&
            candidate.protocol === remoteCandidate.protocol &&
            candidate.type === remoteCandidate.type;
      });
  if (!alreadyAdded) {
    iceTransport.addRemoteCandidate(candidate);
  }
  return !alreadyAdded;
}


function makeError(name, description) {
  var e = new Error(description);
  e.name = name;
  // legacy error codes from https://heycam.github.io/webidl/#idl-DOMException-error-names
  e.code = {
    NotSupportedError: 9,
    InvalidStateError: 11,
    InvalidAccessError: 15,
    TypeError: undefined,
    OperationError: undefined
  }[name];
  return e;
}

module.exports = function(window, edgeVersion) {
  // https://w3c.github.io/mediacapture-main/#mediastream
  // Helper function to add the track to the stream and
  // dispatch the event ourselves.
  function addTrackToStreamAndFireEvent(track, stream) {
    stream.addTrack(track);
    stream.dispatchEvent(new window.MediaStreamTrackEvent('addtrack',
        {track: track}));
  }

  function removeTrackFromStreamAndFireEvent(track, stream) {
    stream.removeTrack(track);
    stream.dispatchEvent(new window.MediaStreamTrackEvent('removetrack',
        {track: track}));
  }

  function fireAddTrack(pc, track, receiver, streams) {
    var trackEvent = new Event('track');
    trackEvent.track = track;
    trackEvent.receiver = receiver;
    trackEvent.transceiver = {receiver: receiver};
    trackEvent.streams = streams;
    window.setTimeout(function() {
      pc._dispatchEvent('track', trackEvent);
    });
  }

  var RTCPeerConnection = function(config) {
    var pc = this;

    var _eventTarget = document.createDocumentFragment();
    ['addEventListener', 'removeEventListener', 'dispatchEvent']
        .forEach(function(method) {
          pc[method] = _eventTarget[method].bind(_eventTarget);
        });

    this.canTrickleIceCandidates = null;

    this.needNegotiation = false;

    this.localStreams = [];
    this.remoteStreams = [];

    this._localDescription = null;
    this._remoteDescription = null;

    this.signalingState = 'stable';
    this.iceConnectionState = 'new';
    this.connectionState = 'new';
    this.iceGatheringState = 'new';

    config = JSON.parse(JSON.stringify(config || {}));

    this.usingBundle = config.bundlePolicy === 'max-bundle';
    if (config.rtcpMuxPolicy === 'negotiate') {
      throw(makeError('NotSupportedError',
          'rtcpMuxPolicy \'negotiate\' is not supported'));
    } else if (!config.rtcpMuxPolicy) {
      config.rtcpMuxPolicy = 'require';
    }

    switch (config.iceTransportPolicy) {
      case 'all':
      case 'relay':
        break;
      default:
        config.iceTransportPolicy = 'all';
        break;
    }

    switch (config.bundlePolicy) {
      case 'balanced':
      case 'max-compat':
      case 'max-bundle':
        break;
      default:
        config.bundlePolicy = 'balanced';
        break;
    }

    config.iceServers = filterIceServers(config.iceServers || [], edgeVersion);

    this._iceGatherers = [];
    if (config.iceCandidatePoolSize) {
      for (var i = config.iceCandidatePoolSize; i > 0; i--) {
        this._iceGatherers.push(new window.RTCIceGatherer({
          iceServers: config.iceServers,
          gatherPolicy: config.iceTransportPolicy
        }));
      }
    } else {
      config.iceCandidatePoolSize = 0;
    }

    this._config = config;

    // per-track iceGathers, iceTransports, dtlsTransports, rtpSenders, ...
    // everything that is needed to describe a SDP m-line.
    this.transceivers = [];

    this._sdpSessionId = SDPUtils.generateSessionId();
    this._sdpSessionVersion = 0;

    this._dtlsRole = undefined; // role for a=setup to use in answers.

    this._isClosed = false;
  };

  Object.defineProperty(RTCPeerConnection.prototype, 'localDescription', {
    configurable: true,
    get: function() {
      return this._localDescription;
    }
  });
  Object.defineProperty(RTCPeerConnection.prototype, 'remoteDescription', {
    configurable: true,
    get: function() {
      return this._remoteDescription;
    }
  });

  // set up event handlers on prototype
  RTCPeerConnection.prototype.onicecandidate = null;
  RTCPeerConnection.prototype.onaddstream = null;
  RTCPeerConnection.prototype.ontrack = null;
  RTCPeerConnection.prototype.onremovestream = null;
  RTCPeerConnection.prototype.onsignalingstatechange = null;
  RTCPeerConnection.prototype.oniceconnectionstatechange = null;
  RTCPeerConnection.prototype.onconnectionstatechange = null;
  RTCPeerConnection.prototype.onicegatheringstatechange = null;
  RTCPeerConnection.prototype.onnegotiationneeded = null;
  RTCPeerConnection.prototype.ondatachannel = null;

  RTCPeerConnection.prototype._dispatchEvent = function(name, event) {
    if (this._isClosed) {
      return;
    }
    this.dispatchEvent(event);
    if (typeof this['on' + name] === 'function') {
      this['on' + name](event);
    }
  };

  RTCPeerConnection.prototype._emitGatheringStateChange = function() {
    var event = new Event('icegatheringstatechange');
    this._dispatchEvent('icegatheringstatechange', event);
  };

  RTCPeerConnection.prototype.getConfiguration = function() {
    return this._config;
  };

  RTCPeerConnection.prototype.getLocalStreams = function() {
    return this.localStreams;
  };

  RTCPeerConnection.prototype.getRemoteStreams = function() {
    return this.remoteStreams;
  };

  // internal helper to create a transceiver object.
  // (which is not yet the same as the WebRTC 1.0 transceiver)
  RTCPeerConnection.prototype._createTransceiver = function(kind, doNotAdd) {
    var hasBundleTransport = this.transceivers.length > 0;
    var transceiver = {
      track: null,
      iceGatherer: null,
      iceTransport: null,
      dtlsTransport: null,
      localCapabilities: null,
      remoteCapabilities: null,
      rtpSender: null,
      rtpReceiver: null,
      kind: kind,
      mid: null,
      sendEncodingParameters: null,
      recvEncodingParameters: null,
      stream: null,
      associatedRemoteMediaStreams: [],
      wantReceive: true
    };
    if (this.usingBundle && hasBundleTransport) {
      transceiver.iceTransport = this.transceivers[0].iceTransport;
      transceiver.dtlsTransport = this.transceivers[0].dtlsTransport;
    } else {
      var transports = this._createIceAndDtlsTransports();
      transceiver.iceTransport = transports.iceTransport;
      transceiver.dtlsTransport = transports.dtlsTransport;
    }
    if (!doNotAdd) {
      this.transceivers.push(transceiver);
    }
    return transceiver;
  };

  RTCPeerConnection.prototype.addTrack = function(track, stream) {
    if (this._isClosed) {
      throw makeError('InvalidStateError',
          'Attempted to call addTrack on a closed peerconnection.');
    }

    var alreadyExists = this.transceivers.find(function(s) {
      return s.track === track;
    });

    if (alreadyExists) {
      throw makeError('InvalidAccessError', 'Track already exists.');
    }

    var transceiver;
    for (var i = 0; i < this.transceivers.length; i++) {
      if (!this.transceivers[i].track &&
          this.transceivers[i].kind === track.kind) {
        transceiver = this.transceivers[i];
      }
    }
    if (!transceiver) {
      transceiver = this._createTransceiver(track.kind);
    }

    this._maybeFireNegotiationNeeded();

    if (this.localStreams.indexOf(stream) === -1) {
      this.localStreams.push(stream);
    }

    transceiver.track = track;
    transceiver.stream = stream;
    transceiver.rtpSender = new window.RTCRtpSender(track,
        transceiver.dtlsTransport);
    return transceiver.rtpSender;
  };

  RTCPeerConnection.prototype.addStream = function(stream) {
    var pc = this;
    if (edgeVersion >= 15025) {
      stream.getTracks().forEach(function(track) {
        pc.addTrack(track, stream);
      });
    } else {
      // Clone is necessary for local demos mostly, attaching directly
      // to two different senders does not work (build 10547).
      // Fixed in 15025 (or earlier)
      var clonedStream = stream.clone();
      stream.getTracks().forEach(function(track, idx) {
        var clonedTrack = clonedStream.getTracks()[idx];
        track.addEventListener('enabled', function(event) {
          clonedTrack.enabled = event.enabled;
        });
      });
      clonedStream.getTracks().forEach(function(track) {
        pc.addTrack(track, clonedStream);
      });
    }
  };

  RTCPeerConnection.prototype.removeTrack = function(sender) {
    if (this._isClosed) {
      throw makeError('InvalidStateError',
          'Attempted to call removeTrack on a closed peerconnection.');
    }

    if (!(sender instanceof window.RTCRtpSender)) {
      throw new TypeError('Argument 1 of RTCPeerConnection.removeTrack ' +
          'does not implement interface RTCRtpSender.');
    }

    var transceiver = this.transceivers.find(function(t) {
      return t.rtpSender === sender;
    });

    if (!transceiver) {
      throw makeError('InvalidAccessError',
          'Sender was not created by this connection.');
    }
    var stream = transceiver.stream;

    transceiver.rtpSender.stop();
    transceiver.rtpSender = null;
    transceiver.track = null;
    transceiver.stream = null;

    // remove the stream from the set of local streams
    var localStreams = this.transceivers.map(function(t) {
      return t.stream;
    });
    if (localStreams.indexOf(stream) === -1 &&
        this.localStreams.indexOf(stream) > -1) {
      this.localStreams.splice(this.localStreams.indexOf(stream), 1);
    }

    this._maybeFireNegotiationNeeded();
  };

  RTCPeerConnection.prototype.removeStream = function(stream) {
    var pc = this;
    stream.getTracks().forEach(function(track) {
      var sender = pc.getSenders().find(function(s) {
        return s.track === track;
      });
      if (sender) {
        pc.removeTrack(sender);
      }
    });
  };

  RTCPeerConnection.prototype.getSenders = function() {
    return this.transceivers.filter(function(transceiver) {
      return !!transceiver.rtpSender;
    })
    .map(function(transceiver) {
      return transceiver.rtpSender;
    });
  };

  RTCPeerConnection.prototype.getReceivers = function() {
    return this.transceivers.filter(function(transceiver) {
      return !!transceiver.rtpReceiver;
    })
    .map(function(transceiver) {
      return transceiver.rtpReceiver;
    });
  };


  RTCPeerConnection.prototype._createIceGatherer = function(sdpMLineIndex,
      usingBundle) {
    var pc = this;
    if (usingBundle && sdpMLineIndex > 0) {
      return this.transceivers[0].iceGatherer;
    } else if (this._iceGatherers.length) {
      return this._iceGatherers.shift();
    }
    var iceGatherer = new window.RTCIceGatherer({
      iceServers: this._config.iceServers,
      gatherPolicy: this._config.iceTransportPolicy
    });
    Object.defineProperty(iceGatherer, 'state',
        {value: 'new', writable: true}
    );

    this.transceivers[sdpMLineIndex].bufferedCandidateEvents = [];
    this.transceivers[sdpMLineIndex].bufferCandidates = function(event) {
      var end = !event.candidate || Object.keys(event.candidate).length === 0;
      // polyfill since RTCIceGatherer.state is not implemented in
      // Edge 10547 yet.
      iceGatherer.state = end ? 'completed' : 'gathering';
      if (pc.transceivers[sdpMLineIndex].bufferedCandidateEvents !== null) {
        pc.transceivers[sdpMLineIndex].bufferedCandidateEvents.push(event);
      }
    };
    iceGatherer.addEventListener('localcandidate',
      this.transceivers[sdpMLineIndex].bufferCandidates);
    return iceGatherer;
  };

  // start gathering from an RTCIceGatherer.
  RTCPeerConnection.prototype._gather = function(mid, sdpMLineIndex) {
    var pc = this;
    var iceGatherer = this.transceivers[sdpMLineIndex].iceGatherer;
    if (iceGatherer.onlocalcandidate) {
      return;
    }
    var bufferedCandidateEvents =
      this.transceivers[sdpMLineIndex].bufferedCandidateEvents;
    this.transceivers[sdpMLineIndex].bufferedCandidateEvents = null;
    iceGatherer.removeEventListener('localcandidate',
      this.transceivers[sdpMLineIndex].bufferCandidates);
    iceGatherer.onlocalcandidate = function(evt) {
      if (pc.usingBundle && sdpMLineIndex > 0) {
        // if we know that we use bundle we can drop candidates with
        // ѕdpMLineIndex > 0. If we don't do this then our state gets
        // confused since we dispose the extra ice gatherer.
        return;
      }
      var event = new Event('icecandidate');
      event.candidate = {sdpMid: mid, sdpMLineIndex: sdpMLineIndex};

      var cand = evt.candidate;
      // Edge emits an empty object for RTCIceCandidateComplete‥
      var end = !cand || Object.keys(cand).length === 0;
      if (end) {
        // polyfill since RTCIceGatherer.state is not implemented in
        // Edge 10547 yet.
        if (iceGatherer.state === 'new' || iceGatherer.state === 'gathering') {
          iceGatherer.state = 'completed';
        }
      } else {
        if (iceGatherer.state === 'new') {
          iceGatherer.state = 'gathering';
        }
        // RTCIceCandidate doesn't have a component, needs to be added
        cand.component = 1;
        // also the usernameFragment. TODO: update SDP to take both variants.
        cand.ufrag = iceGatherer.getLocalParameters().usernameFragment;

        var serializedCandidate = SDPUtils.writeCandidate(cand);
        event.candidate = Object.assign(event.candidate,
            SDPUtils.parseCandidate(serializedCandidate));

        event.candidate.candidate = serializedCandidate;
        event.candidate.toJSON = function() {
          return {
            candidate: event.candidate.candidate,
            sdpMid: event.candidate.sdpMid,
            sdpMLineIndex: event.candidate.sdpMLineIndex,
            usernameFragment: event.candidate.usernameFragment
          };
        };
      }

      // update local description.
      var sections = SDPUtils.getMediaSections(pc._localDescription.sdp);
      if (!end) {
        sections[event.candidate.sdpMLineIndex] +=
            'a=' + event.candidate.candidate + '\r\n';
      } else {
        sections[event.candidate.sdpMLineIndex] +=
            'a=end-of-candidates\r\n';
      }
      pc._localDescription.sdp =
          SDPUtils.getDescription(pc._localDescription.sdp) +
          sections.join('');
      var complete = pc.transceivers.every(function(transceiver) {
        return transceiver.iceGatherer &&
            transceiver.iceGatherer.state === 'completed';
      });

      if (pc.iceGatheringState !== 'gathering') {
        pc.iceGatheringState = 'gathering';
        pc._emitGatheringStateChange();
      }

      // Emit candidate. Also emit null candidate when all gatherers are
      // complete.
      if (!end) {
        pc._dispatchEvent('icecandidate', event);
      }
      if (complete) {
        pc._dispatchEvent('icecandidate', new Event('icecandidate'));
        pc.iceGatheringState = 'complete';
        pc._emitGatheringStateChange();
      }
    };

    // emit already gathered candidates.
    window.setTimeout(function() {
      bufferedCandidateEvents.forEach(function(e) {
        iceGatherer.onlocalcandidate(e);
      });
    }, 0);
  };

  // Create ICE transport and DTLS transport.
  RTCPeerConnection.prototype._createIceAndDtlsTransports = function() {
    var pc = this;
    var iceTransport = new window.RTCIceTransport(null);
    iceTransport.onicestatechange = function() {
      pc._updateIceConnectionState();
      pc._updateConnectionState();
    };

    var dtlsTransport = new window.RTCDtlsTransport(iceTransport);
    dtlsTransport.ondtlsstatechange = function() {
      pc._updateConnectionState();
    };
    dtlsTransport.onerror = function() {
      // onerror does not set state to failed by itself.
      Object.defineProperty(dtlsTransport, 'state',
          {value: 'failed', writable: true});
      pc._updateConnectionState();
    };

    return {
      iceTransport: iceTransport,
      dtlsTransport: dtlsTransport
    };
  };

  // Destroy ICE gatherer, ICE transport and DTLS transport.
  // Without triggering the callbacks.
  RTCPeerConnection.prototype._disposeIceAndDtlsTransports = function(
      sdpMLineIndex) {
    var iceGatherer = this.transceivers[sdpMLineIndex].iceGatherer;
    if (iceGatherer) {
      delete iceGatherer.onlocalcandidate;
      delete this.transceivers[sdpMLineIndex].iceGatherer;
    }
    var iceTransport = this.transceivers[sdpMLineIndex].iceTransport;
    if (iceTransport) {
      delete iceTransport.onicestatechange;
      delete this.transceivers[sdpMLineIndex].iceTransport;
    }
    var dtlsTransport = this.transceivers[sdpMLineIndex].dtlsTransport;
    if (dtlsTransport) {
      delete dtlsTransport.ondtlsstatechange;
      delete dtlsTransport.onerror;
      delete this.transceivers[sdpMLineIndex].dtlsTransport;
    }
  };

  // Start the RTP Sender and Receiver for a transceiver.
  RTCPeerConnection.prototype._transceive = function(transceiver,
      send, recv) {
    var params = getCommonCapabilities(transceiver.localCapabilities,
        transceiver.remoteCapabilities);
    if (send && transceiver.rtpSender) {
      params.encodings = transceiver.sendEncodingParameters;
      params.rtcp = {
        cname: SDPUtils.localCName,
        compound: transceiver.rtcpParameters.compound
      };
      if (transceiver.recvEncodingParameters.length) {
        params.rtcp.ssrc = transceiver.recvEncodingParameters[0].ssrc;
      }
      transceiver.rtpSender.send(params);
    }
    if (recv && transceiver.rtpReceiver && params.codecs.length > 0) {
      // remove RTX field in Edge 14942
      if (transceiver.kind === 'video'
          && transceiver.recvEncodingParameters
          && edgeVersion < 15019) {
        transceiver.recvEncodingParameters.forEach(function(p) {
          delete p.rtx;
        });
      }
      if (transceiver.recvEncodingParameters.length) {
        params.encodings = transceiver.recvEncodingParameters;
      } else {
        params.encodings = [{}];
      }
      params.rtcp = {
        compound: transceiver.rtcpParameters.compound
      };
      if (transceiver.rtcpParameters.cname) {
        params.rtcp.cname = transceiver.rtcpParameters.cname;
      }
      if (transceiver.sendEncodingParameters.length) {
        params.rtcp.ssrc = transceiver.sendEncodingParameters[0].ssrc;
      }
      transceiver.rtpReceiver.receive(params);
    }
  };

  RTCPeerConnection.prototype.setLocalDescription = function(description) {
    var pc = this;

    // Note: pranswer is not supported.
    if (['offer', 'answer'].indexOf(description.type) === -1) {
      return Promise.reject(makeError('TypeError',
          'Unsupported type "' + description.type + '"'));
    }

    if (!isActionAllowedInSignalingState('setLocalDescription',
        description.type, pc.signalingState) || pc._isClosed) {
      return Promise.reject(makeError('InvalidStateError',
          'Can not set local ' + description.type +
          ' in state ' + pc.signalingState));
    }

    var sections;
    var sessionpart;
    if (description.type === 'offer') {
      // VERY limited support for SDP munging. Limited to:
      // * changing the order of codecs
      sections = SDPUtils.splitSections(description.sdp);
      sessionpart = sections.shift();
      sections.forEach(function(mediaSection, sdpMLineIndex) {
        var caps = SDPUtils.parseRtpParameters(mediaSection);
        pc.transceivers[sdpMLineIndex].localCapabilities = caps;
      });

      pc.transceivers.forEach(function(transceiver, sdpMLineIndex) {
        pc._gather(transceiver.mid, sdpMLineIndex);
      });
    } else if (description.type === 'answer') {
      sections = SDPUtils.splitSections(pc._remoteDescription.sdp);
      sessionpart = sections.shift();
      var isIceLite = SDPUtils.matchPrefix(sessionpart,
          'a=ice-lite').length > 0;
      sections.forEach(function(mediaSection, sdpMLineIndex) {
        var transceiver = pc.transceivers[sdpMLineIndex];
        var iceGatherer = transceiver.iceGatherer;
        var iceTransport = transceiver.iceTransport;
        var dtlsTransport = transceiver.dtlsTransport;
        var localCapabilities = transceiver.localCapabilities;
        var remoteCapabilities = transceiver.remoteCapabilities;

        // treat bundle-only as not-rejected.
        var rejected = SDPUtils.isRejected(mediaSection) &&
            SDPUtils.matchPrefix(mediaSection, 'a=bundle-only').length === 0;

        if (!rejected && !transceiver.rejected) {
          var remoteIceParameters = SDPUtils.getIceParameters(
              mediaSection, sessionpart);
          var remoteDtlsParameters = SDPUtils.getDtlsParameters(
              mediaSection, sessionpart);
          if (isIceLite) {
            remoteDtlsParameters.role = 'server';
          }

          if (!pc.usingBundle || sdpMLineIndex === 0) {
            pc._gather(transceiver.mid, sdpMLineIndex);
            if (iceTransport.state === 'new') {
              iceTransport.start(iceGatherer, remoteIceParameters,
                  isIceLite ? 'controlling' : 'controlled');
            }
            if (dtlsTransport.state === 'new') {
              dtlsTransport.start(remoteDtlsParameters);
            }
          }

          // Calculate intersection of capabilities.
          var params = getCommonCapabilities(localCapabilities,
              remoteCapabilities);

          // Start the RTCRtpSender. The RTCRtpReceiver for this
          // transceiver has already been started in setRemoteDescription.
          pc._transceive(transceiver,
              params.codecs.length > 0,
              false);
        }
      });
    }

    pc._localDescription = {
      type: description.type,
      sdp: description.sdp
    };
    if (description.type === 'offer') {
      pc._updateSignalingState('have-local-offer');
    } else {
      pc._updateSignalingState('stable');
    }

    return Promise.resolve();
  };

  RTCPeerConnection.prototype.setRemoteDescription = function(description) {
    var pc = this;

    // Note: pranswer is not supported.
    if (['offer', 'answer'].indexOf(description.type) === -1) {
      return Promise.reject(makeError('TypeError',
          'Unsupported type "' + description.type + '"'));
    }

    if (!isActionAllowedInSignalingState('setRemoteDescription',
        description.type, pc.signalingState) || pc._isClosed) {
      return Promise.reject(makeError('InvalidStateError',
          'Can not set remote ' + description.type +
          ' in state ' + pc.signalingState));
    }

    var streams = {};
    pc.remoteStreams.forEach(function(stream) {
      streams[stream.id] = stream;
    });
    var receiverList = [];
    var sections = SDPUtils.splitSections(description.sdp);
    var sessionpart = sections.shift();
    var isIceLite = SDPUtils.matchPrefix(sessionpart,
        'a=ice-lite').length > 0;
    var usingBundle = SDPUtils.matchPrefix(sessionpart,
        'a=group:BUNDLE ').length > 0;
    pc.usingBundle = usingBundle;
    var iceOptions = SDPUtils.matchPrefix(sessionpart,
        'a=ice-options:')[0];
    if (iceOptions) {
      pc.canTrickleIceCandidates = iceOptions.substr(14).split(' ')
          .indexOf('trickle') >= 0;
    } else {
      pc.canTrickleIceCandidates = false;
    }

    sections.forEach(function(mediaSection, sdpMLineIndex) {
      var lines = SDPUtils.splitLines(mediaSection);
      var kind = SDPUtils.getKind(mediaSection);
      // treat bundle-only as not-rejected.
      var rejected = SDPUtils.isRejected(mediaSection) &&
          SDPUtils.matchPrefix(mediaSection, 'a=bundle-only').length === 0;
      var protocol = lines[0].substr(2).split(' ')[2];

      var direction = SDPUtils.getDirection(mediaSection, sessionpart);
      var remoteMsid = SDPUtils.parseMsid(mediaSection);

      var mid = SDPUtils.getMid(mediaSection) || SDPUtils.generateIdentifier();

      // Reject datachannels which are not implemented yet.
      if (rejected || (kind === 'application' && (protocol === 'DTLS/SCTP' ||
          protocol === 'UDP/DTLS/SCTP'))) {
        // TODO: this is dangerous in the case where a non-rejected m-line
        //     becomes rejected.
        pc.transceivers[sdpMLineIndex] = {
          mid: mid,
          kind: kind,
          protocol: protocol,
          rejected: true
        };
        return;
      }

      if (!rejected && pc.transceivers[sdpMLineIndex] &&
          pc.transceivers[sdpMLineIndex].rejected) {
        // recycle a rejected transceiver.
        pc.transceivers[sdpMLineIndex] = pc._createTransceiver(kind, true);
      }

      var transceiver;
      var iceGatherer;
      var iceTransport;
      var dtlsTransport;
      var rtpReceiver;
      var sendEncodingParameters;
      var recvEncodingParameters;
      var localCapabilities;

      var track;
      // FIXME: ensure the mediaSection has rtcp-mux set.
      var remoteCapabilities = SDPUtils.parseRtpParameters(mediaSection);
      var remoteIceParameters;
      var remoteDtlsParameters;
      if (!rejected) {
        remoteIceParameters = SDPUtils.getIceParameters(mediaSection,
            sessionpart);
        remoteDtlsParameters = SDPUtils.getDtlsParameters(mediaSection,
            sessionpart);
        remoteDtlsParameters.role = 'client';
      }
      recvEncodingParameters =
          SDPUtils.parseRtpEncodingParameters(mediaSection);

      var rtcpParameters = SDPUtils.parseRtcpParameters(mediaSection);

      var isComplete = SDPUtils.matchPrefix(mediaSection,
          'a=end-of-candidates', sessionpart).length > 0;
      var cands = SDPUtils.matchPrefix(mediaSection, 'a=candidate:')
          .map(function(cand) {
            return SDPUtils.parseCandidate(cand);
          })
          .filter(function(cand) {
            return cand.component === 1;
          });

      // Check if we can use BUNDLE and dispose transports.
      if ((description.type === 'offer' || description.type === 'answer') &&
          !rejected && usingBundle && sdpMLineIndex > 0 &&
          pc.transceivers[sdpMLineIndex]) {
        pc._disposeIceAndDtlsTransports(sdpMLineIndex);
        pc.transceivers[sdpMLineIndex].iceGatherer =
            pc.transceivers[0].iceGatherer;
        pc.transceivers[sdpMLineIndex].iceTransport =
            pc.transceivers[0].iceTransport;
        pc.transceivers[sdpMLineIndex].dtlsTransport =
            pc.transceivers[0].dtlsTransport;
        if (pc.transceivers[sdpMLineIndex].rtpSender) {
          pc.transceivers[sdpMLineIndex].rtpSender.setTransport(
              pc.transceivers[0].dtlsTransport);
        }
        if (pc.transceivers[sdpMLineIndex].rtpReceiver) {
          pc.transceivers[sdpMLineIndex].rtpReceiver.setTransport(
              pc.transceivers[0].dtlsTransport);
        }
      }
      if (description.type === 'offer' && !rejected) {
        transceiver = pc.transceivers[sdpMLineIndex] ||
            pc._createTransceiver(kind);
        transceiver.mid = mid;

        if (!transceiver.iceGatherer) {
          transceiver.iceGatherer = pc._createIceGatherer(sdpMLineIndex,
              usingBundle);
        }

        if (cands.length && transceiver.iceTransport.state === 'new') {
          if (isComplete && (!usingBundle || sdpMLineIndex === 0)) {
            transceiver.iceTransport.setRemoteCandidates(cands);
          } else {
            cands.forEach(function(candidate) {
              maybeAddCandidate(transceiver.iceTransport, candidate);
            });
          }
        }

        localCapabilities = window.RTCRtpReceiver.getCapabilities(kind);

        // filter RTX until additional stuff needed for RTX is implemented
        // in adapter.js
        if (edgeVersion < 15019) {
          localCapabilities.codecs = localCapabilities.codecs.filter(
              function(codec) {
                return codec.name !== 'rtx';
              });
        }

        sendEncodingParameters = transceiver.sendEncodingParameters || [{
          ssrc: (2 * sdpMLineIndex + 2) * 1001
        }];

        // TODO: rewrite to use http://w3c.github.io/webrtc-pc/#set-associated-remote-streams
        var isNewTrack = false;
        if (direction === 'sendrecv' || direction === 'sendonly') {
          isNewTrack = !transceiver.rtpReceiver;
          rtpReceiver = transceiver.rtpReceiver ||
              new window.RTCRtpReceiver(transceiver.dtlsTransport, kind);

          if (isNewTrack) {
            var stream;
            track = rtpReceiver.track;
            // FIXME: does not work with Plan B.
            if (remoteMsid && remoteMsid.stream === '-') {
              // no-op. a stream id of '-' means: no associated stream.
            } else if (remoteMsid) {
              if (!streams[remoteMsid.stream]) {
                streams[remoteMsid.stream] = new window.MediaStream();
                Object.defineProperty(streams[remoteMsid.stream], 'id', {
                  get: function() {
                    return remoteMsid.stream;
                  }
                });
              }
              Object.defineProperty(track, 'id', {
                get: function() {
                  return remoteMsid.track;
                }
              });
              stream = streams[remoteMsid.stream];
            } else {
              if (!streams.default) {
                streams.default = new window.MediaStream();
              }
              stream = streams.default;
            }
            if (stream) {
              addTrackToStreamAndFireEvent(track, stream);
              transceiver.associatedRemoteMediaStreams.push(stream);
            }
            receiverList.push([track, rtpReceiver, stream]);
          }
        } else if (transceiver.rtpReceiver && transceiver.rtpReceiver.track) {
          transceiver.associatedRemoteMediaStreams.forEach(function(s) {
            var nativeTrack = s.getTracks().find(function(t) {
              return t.id === transceiver.rtpReceiver.track.id;
            });
            if (nativeTrack) {
              removeTrackFromStreamAndFireEvent(nativeTrack, s);
            }
          });
          transceiver.associatedRemoteMediaStreams = [];
        }

        transceiver.localCapabilities = localCapabilities;
        transceiver.remoteCapabilities = remoteCapabilities;
        transceiver.rtpReceiver = rtpReceiver;
        transceiver.rtcpParameters = rtcpParameters;
        transceiver.sendEncodingParameters = sendEncodingParameters;
        transceiver.recvEncodingParameters = recvEncodingParameters;

        // Start the RTCRtpReceiver now. The RTPSender is started in
        // setLocalDescription.
        pc._transceive(pc.transceivers[sdpMLineIndex],
            false,
            isNewTrack);
      } else if (description.type === 'answer' && !rejected) {
        transceiver = pc.transceivers[sdpMLineIndex];
        iceGatherer = transceiver.iceGatherer;
        iceTransport = transceiver.iceTransport;
        dtlsTransport = transceiver.dtlsTransport;
        rtpReceiver = transceiver.rtpReceiver;
        sendEncodingParameters = transceiver.sendEncodingParameters;
        localCapabilities = transceiver.localCapabilities;

        pc.transceivers[sdpMLineIndex].recvEncodingParameters =
            recvEncodingParameters;
        pc.transceivers[sdpMLineIndex].remoteCapabilities =
            remoteCapabilities;
        pc.transceivers[sdpMLineIndex].rtcpParameters = rtcpParameters;

        if (cands.length && iceTransport.state === 'new') {
          if ((isIceLite || isComplete) &&
              (!usingBundle || sdpMLineIndex === 0)) {
            iceTransport.setRemoteCandidates(cands);
          } else {
            cands.forEach(function(candidate) {
              maybeAddCandidate(transceiver.iceTransport, candidate);
            });
          }
        }

        if (!usingBundle || sdpMLineIndex === 0) {
          if (iceTransport.state === 'new') {
            iceTransport.start(iceGatherer, remoteIceParameters,
                'controlling');
          }
          if (dtlsTransport.state === 'new') {
            dtlsTransport.start(remoteDtlsParameters);
          }
        }

        // If the offer contained RTX but the answer did not,
        // remove RTX from sendEncodingParameters.
        var commonCapabilities = getCommonCapabilities(
          transceiver.localCapabilities,
          transceiver.remoteCapabilities);

        var hasRtx = commonCapabilities.codecs.filter(function(c) {
          return c.name.toLowerCase() === 'rtx';
        }).length;
        if (!hasRtx && transceiver.sendEncodingParameters[0].rtx) {
          delete transceiver.sendEncodingParameters[0].rtx;
        }

        pc._transceive(transceiver,
            direction === 'sendrecv' || direction === 'recvonly',
            direction === 'sendrecv' || direction === 'sendonly');

        // TODO: rewrite to use http://w3c.github.io/webrtc-pc/#set-associated-remote-streams
        if (rtpReceiver &&
            (direction === 'sendrecv' || direction === 'sendonly')) {
          track = rtpReceiver.track;
          if (remoteMsid) {
            if (!streams[remoteMsid.stream]) {
              streams[remoteMsid.stream] = new window.MediaStream();
            }
            addTrackToStreamAndFireEvent(track, streams[remoteMsid.stream]);
            receiverList.push([track, rtpReceiver, streams[remoteMsid.stream]]);
          } else {
            if (!streams.default) {
              streams.default = new window.MediaStream();
            }
            addTrackToStreamAndFireEvent(track, streams.default);
            receiverList.push([track, rtpReceiver, streams.default]);
          }
        } else {
          // FIXME: actually the receiver should be created later.
          delete transceiver.rtpReceiver;
        }
      }
    });

    if (pc._dtlsRole === undefined) {
      pc._dtlsRole = description.type === 'offer' ? 'active' : 'passive';
    }

    pc._remoteDescription = {
      type: description.type,
      sdp: description.sdp
    };
    if (description.type === 'offer') {
      pc._updateSignalingState('have-remote-offer');
    } else {
      pc._updateSignalingState('stable');
    }
    Object.keys(streams).forEach(function(sid) {
      var stream = streams[sid];
      if (stream.getTracks().length) {
        if (pc.remoteStreams.indexOf(stream) === -1) {
          pc.remoteStreams.push(stream);
          var event = new Event('addstream');
          event.stream = stream;
          window.setTimeout(function() {
            pc._dispatchEvent('addstream', event);
          });
        }

        receiverList.forEach(function(item) {
          var track = item[0];
          var receiver = item[1];
          if (stream.id !== item[2].id) {
            return;
          }
          fireAddTrack(pc, track, receiver, [stream]);
        });
      }
    });
    receiverList.forEach(function(item) {
      if (item[2]) {
        return;
      }
      fireAddTrack(pc, item[0], item[1], []);
    });

    // check whether addIceCandidate({}) was called within four seconds after
    // setRemoteDescription.
    window.setTimeout(function() {
      if (!(pc && pc.transceivers)) {
        return;
      }
      pc.transceivers.forEach(function(transceiver) {
        if (transceiver.iceTransport &&
            transceiver.iceTransport.state === 'new' &&
            transceiver.iceTransport.getRemoteCandidates().length > 0) {
          console.warn('Timeout for addRemoteCandidate. Consider sending ' +
              'an end-of-candidates notification');
          transceiver.iceTransport.addRemoteCandidate({});
        }
      });
    }, 4000);

    return Promise.resolve();
  };

  RTCPeerConnection.prototype.close = function() {
    this.transceivers.forEach(function(transceiver) {
      /* not yet
      if (transceiver.iceGatherer) {
        transceiver.iceGatherer.close();
      }
      */
      if (transceiver.iceTransport) {
        transceiver.iceTransport.stop();
      }
      if (transceiver.dtlsTransport) {
        transceiver.dtlsTransport.stop();
      }
      if (transceiver.rtpSender) {
        transceiver.rtpSender.stop();
      }
      if (transceiver.rtpReceiver) {
        transceiver.rtpReceiver.stop();
      }
    });
    // FIXME: clean up tracks, local streams, remote streams, etc
    this._isClosed = true;
    this._updateSignalingState('closed');
  };

  // Update the signaling state.
  RTCPeerConnection.prototype._updateSignalingState = function(newState) {
    this.signalingState = newState;
    var event = new Event('signalingstatechange');
    this._dispatchEvent('signalingstatechange', event);
  };

  // Determine whether to fire the negotiationneeded event.
  RTCPeerConnection.prototype._maybeFireNegotiationNeeded = function() {
    var pc = this;
    if (this.signalingState !== 'stable' || this.needNegotiation === true) {
      return;
    }
    this.needNegotiation = true;
    window.setTimeout(function() {
      if (pc.needNegotiation) {
        pc.needNegotiation = false;
        var event = new Event('negotiationneeded');
        pc._dispatchEvent('negotiationneeded', event);
      }
    }, 0);
  };

  // Update the ice connection state.
  RTCPeerConnection.prototype._updateIceConnectionState = function() {
    var newState;
    var states = {
      'new': 0,
      closed: 0,
      checking: 0,
      connected: 0,
      completed: 0,
      disconnected: 0,
      failed: 0
    };
    this.transceivers.forEach(function(transceiver) {
      states[transceiver.iceTransport.state]++;
    });

    newState = 'new';
    if (states.failed > 0) {
      newState = 'failed';
    } else if (states.checking > 0) {
      newState = 'checking';
    } else if (states.disconnected > 0) {
      newState = 'disconnected';
    } else if (states.new > 0) {
      newState = 'new';
    } else if (states.connected > 0) {
      newState = 'connected';
    } else if (states.completed > 0) {
      newState = 'completed';
    }

    if (newState !== this.iceConnectionState) {
      this.iceConnectionState = newState;
      var event = new Event('iceconnectionstatechange');
      this._dispatchEvent('iceconnectionstatechange', event);
    }
  };

  // Update the connection state.
  RTCPeerConnection.prototype._updateConnectionState = function() {
    var newState;
    var states = {
      'new': 0,
      closed: 0,
      connecting: 0,
      connected: 0,
      completed: 0,
      disconnected: 0,
      failed: 0
    };
    this.transceivers.forEach(function(transceiver) {
      states[transceiver.iceTransport.state]++;
      states[transceiver.dtlsTransport.state]++;
    });
    // ICETransport.completed and connected are the same for this purpose.
    states.connected += states.completed;

    newState = 'new';
    if (states.failed > 0) {
      newState = 'failed';
    } else if (states.connecting > 0) {
      newState = 'connecting';
    } else if (states.disconnected > 0) {
      newState = 'disconnected';
    } else if (states.new > 0) {
      newState = 'new';
    } else if (states.connected > 0) {
      newState = 'connected';
    }

    if (newState !== this.connectionState) {
      this.connectionState = newState;
      var event = new Event('connectionstatechange');
      this._dispatchEvent('connectionstatechange', event);
    }
  };

  RTCPeerConnection.prototype.createOffer = function() {
    var pc = this;

    if (pc._isClosed) {
      return Promise.reject(makeError('InvalidStateError',
          'Can not call createOffer after close'));
    }

    var numAudioTracks = pc.transceivers.filter(function(t) {
      return t.kind === 'audio';
    }).length;
    var numVideoTracks = pc.transceivers.filter(function(t) {
      return t.kind === 'video';
    }).length;

    // Determine number of audio and video tracks we need to send/recv.
    var offerOptions = arguments[0];
    if (offerOptions) {
      // Reject Chrome legacy constraints.
      if (offerOptions.mandatory || offerOptions.optional) {
        throw new TypeError(
            'Legacy mandatory/optional constraints not supported.');
      }
      if (offerOptions.offerToReceiveAudio !== undefined) {
        if (offerOptions.offerToReceiveAudio === true) {
          numAudioTracks = 1;
        } else if (offerOptions.offerToReceiveAudio === false) {
          numAudioTracks = 0;
        } else {
          numAudioTracks = offerOptions.offerToReceiveAudio;
        }
      }
      if (offerOptions.offerToReceiveVideo !== undefined) {
        if (offerOptions.offerToReceiveVideo === true) {
          numVideoTracks = 1;
        } else if (offerOptions.offerToReceiveVideo === false) {
          numVideoTracks = 0;
        } else {
          numVideoTracks = offerOptions.offerToReceiveVideo;
        }
      }
    }

    pc.transceivers.forEach(function(transceiver) {
      if (transceiver.kind === 'audio') {
        numAudioTracks--;
        if (numAudioTracks < 0) {
          transceiver.wantReceive = false;
        }
      } else if (transceiver.kind === 'video') {
        numVideoTracks--;
        if (numVideoTracks < 0) {
          transceiver.wantReceive = false;
        }
      }
    });

    // Create M-lines for recvonly streams.
    while (numAudioTracks > 0 || numVideoTracks > 0) {
      if (numAudioTracks > 0) {
        pc._createTransceiver('audio');
        numAudioTracks--;
      }
      if (numVideoTracks > 0) {
        pc._createTransceiver('video');
        numVideoTracks--;
      }
    }

    var sdp = SDPUtils.writeSessionBoilerplate(pc._sdpSessionId,
        pc._sdpSessionVersion++);
    pc.transceivers.forEach(function(transceiver, sdpMLineIndex) {
      // For each track, create an ice gatherer, ice transport,
      // dtls transport, potentially rtpsender and rtpreceiver.
      var track = transceiver.track;
      var kind = transceiver.kind;
      var mid = transceiver.mid || SDPUtils.generateIdentifier();
      transceiver.mid = mid;

      if (!transceiver.iceGatherer) {
        transceiver.iceGatherer = pc._createIceGatherer(sdpMLineIndex,
            pc.usingBundle);
      }

      var localCapabilities = window.RTCRtpSender.getCapabilities(kind);
      // filter RTX until additional stuff needed for RTX is implemented
      // in adapter.js
      if (edgeVersion < 15019) {
        localCapabilities.codecs = localCapabilities.codecs.filter(
            function(codec) {
              return codec.name !== 'rtx';
            });
      }
      localCapabilities.codecs.forEach(function(codec) {
        // work around https://bugs.chromium.org/p/webrtc/issues/detail?id=6552
        // by adding level-asymmetry-allowed=1
        if (codec.name === 'H264' &&
            codec.parameters['level-asymmetry-allowed'] === undefined) {
          codec.parameters['level-asymmetry-allowed'] = '1';
        }

        // for subsequent offers, we might have to re-use the payload
        // type of the last offer.
        if (transceiver.remoteCapabilities &&
            transceiver.remoteCapabilities.codecs) {
          transceiver.remoteCapabilities.codecs.forEach(function(remoteCodec) {
            if (codec.name.toLowerCase() === remoteCodec.name.toLowerCase() &&
                codec.clockRate === remoteCodec.clockRate) {
              codec.preferredPayloadType = remoteCodec.payloadType;
            }
          });
        }
      });
      localCapabilities.headerExtensions.forEach(function(hdrExt) {
        var remoteExtensions = transceiver.remoteCapabilities &&
            transceiver.remoteCapabilities.headerExtensions || [];
        remoteExtensions.forEach(function(rHdrExt) {
          if (hdrExt.uri === rHdrExt.uri) {
            hdrExt.id = rHdrExt.id;
          }
        });
      });

      // generate an ssrc now, to be used later in rtpSender.send
      var sendEncodingParameters = transceiver.sendEncodingParameters || [{
        ssrc: (2 * sdpMLineIndex + 1) * 1001
      }];
      if (track) {
        // add RTX
        if (edgeVersion >= 15019 && kind === 'video' &&
            !sendEncodingParameters[0].rtx) {
          sendEncodingParameters[0].rtx = {
            ssrc: sendEncodingParameters[0].ssrc + 1
          };
        }
      }

      if (transceiver.wantReceive) {
        transceiver.rtpReceiver = new window.RTCRtpReceiver(
            transceiver.dtlsTransport, kind);
      }

      transceiver.localCapabilities = localCapabilities;
      transceiver.sendEncodingParameters = sendEncodingParameters;
    });

    // always offer BUNDLE and dispose on return if not supported.
    if (pc._config.bundlePolicy !== 'max-compat') {
      sdp += 'a=group:BUNDLE ' + pc.transceivers.map(function(t) {
        return t.mid;
      }).join(' ') + '\r\n';
    }
    sdp += 'a=ice-options:trickle\r\n';

    pc.transceivers.forEach(function(transceiver, sdpMLineIndex) {
      sdp += writeMediaSection(transceiver, transceiver.localCapabilities,
          'offer', transceiver.stream, pc._dtlsRole);
      sdp += 'a=rtcp-rsize\r\n';

      if (transceiver.iceGatherer && pc.iceGatheringState !== 'new' &&
          (sdpMLineIndex === 0 || !pc.usingBundle)) {
        transceiver.iceGatherer.getLocalCandidates().forEach(function(cand) {
          cand.component = 1;
          sdp += 'a=' + SDPUtils.writeCandidate(cand) + '\r\n';
        });

        if (transceiver.iceGatherer.state === 'completed') {
          sdp += 'a=end-of-candidates\r\n';
        }
      }
    });

    var desc = new window.RTCSessionDescription({
      type: 'offer',
      sdp: sdp
    });
    return Promise.resolve(desc);
  };

  RTCPeerConnection.prototype.createAnswer = function() {
    var pc = this;

    if (pc._isClosed) {
      return Promise.reject(makeError('InvalidStateError',
          'Can not call createAnswer after close'));
    }

    if (!(pc.signalingState === 'have-remote-offer' ||
        pc.signalingState === 'have-local-pranswer')) {
      return Promise.reject(makeError('InvalidStateError',
          'Can not call createAnswer in signalingState ' + pc.signalingState));
    }

    var sdp = SDPUtils.writeSessionBoilerplate(pc._sdpSessionId,
        pc._sdpSessionVersion++);
    if (pc.usingBundle) {
      sdp += 'a=group:BUNDLE ' + pc.transceivers.map(function(t) {
        return t.mid;
      }).join(' ') + '\r\n';
    }
    sdp += 'a=ice-options:trickle\r\n';

    var mediaSectionsInOffer = SDPUtils.getMediaSections(
        pc._remoteDescription.sdp).length;
    pc.transceivers.forEach(function(transceiver, sdpMLineIndex) {
      if (sdpMLineIndex + 1 > mediaSectionsInOffer) {
        return;
      }
      if (transceiver.rejected) {
        if (transceiver.kind === 'application') {
          if (transceiver.protocol === 'DTLS/SCTP') { // legacy fmt
            sdp += 'm=application 0 DTLS/SCTP 5000\r\n';
          } else {
            sdp += 'm=application 0 ' + transceiver.protocol +
                ' webrtc-datachannel\r\n';
          }
        } else if (transceiver.kind === 'audio') {
          sdp += 'm=audio 0 UDP/TLS/RTP/SAVPF 0\r\n' +
              'a=rtpmap:0 PCMU/8000\r\n';
        } else if (transceiver.kind === 'video') {
          sdp += 'm=video 0 UDP/TLS/RTP/SAVPF 120\r\n' +
              'a=rtpmap:120 VP8/90000\r\n';
        }
        sdp += 'c=IN IP4 0.0.0.0\r\n' +
            'a=inactive\r\n' +
            'a=mid:' + transceiver.mid + '\r\n';
        return;
      }

      // FIXME: look at direction.
      if (transceiver.stream) {
        var localTrack;
        if (transceiver.kind === 'audio') {
          localTrack = transceiver.stream.getAudioTracks()[0];
        } else if (transceiver.kind === 'video') {
          localTrack = transceiver.stream.getVideoTracks()[0];
        }
        if (localTrack) {
          // add RTX
          if (edgeVersion >= 15019 && transceiver.kind === 'video' &&
              !transceiver.sendEncodingParameters[0].rtx) {
            transceiver.sendEncodingParameters[0].rtx = {
              ssrc: transceiver.sendEncodingParameters[0].ssrc + 1
            };
          }
        }
      }

      // Calculate intersection of capabilities.
      var commonCapabilities = getCommonCapabilities(
          transceiver.localCapabilities,
          transceiver.remoteCapabilities);

      var hasRtx = commonCapabilities.codecs.filter(function(c) {
        return c.name.toLowerCase() === 'rtx';
      }).length;
      if (!hasRtx && transceiver.sendEncodingParameters[0].rtx) {
        delete transceiver.sendEncodingParameters[0].rtx;
      }

      sdp += writeMediaSection(transceiver, commonCapabilities,
          'answer', transceiver.stream, pc._dtlsRole);
      if (transceiver.rtcpParameters &&
          transceiver.rtcpParameters.reducedSize) {
        sdp += 'a=rtcp-rsize\r\n';
      }
    });

    var desc = new window.RTCSessionDescription({
      type: 'answer',
      sdp: sdp
    });
    return Promise.resolve(desc);
  };

  RTCPeerConnection.prototype.addIceCandidate = function(candidate) {
    var pc = this;
    var sections;
    if (candidate && !(candidate.sdpMLineIndex !== undefined ||
        candidate.sdpMid)) {
      return Promise.reject(new TypeError('sdpMLineIndex or sdpMid required'));
    }

    // TODO: needs to go into ops queue.
    return new Promise(function(resolve, reject) {
      if (!pc._remoteDescription) {
        return reject(makeError('InvalidStateError',
            'Can not add ICE candidate without a remote description'));
      } else if (!candidate || candidate.candidate === '') {
        for (var j = 0; j < pc.transceivers.length; j++) {
          if (pc.transceivers[j].rejected) {
            continue;
          }
          pc.transceivers[j].iceTransport.addRemoteCandidate({});
          sections = SDPUtils.getMediaSections(pc._remoteDescription.sdp);
          sections[j] += 'a=end-of-candidates\r\n';
          pc._remoteDescription.sdp =
              SDPUtils.getDescription(pc._remoteDescription.sdp) +
              sections.join('');
          if (pc.usingBundle) {
            break;
          }
        }
      } else {
        var sdpMLineIndex = candidate.sdpMLineIndex;
        if (candidate.sdpMid) {
          for (var i = 0; i < pc.transceivers.length; i++) {
            if (pc.transceivers[i].mid === candidate.sdpMid) {
              sdpMLineIndex = i;
              break;
            }
          }
        }
        var transceiver = pc.transceivers[sdpMLineIndex];
        if (transceiver) {
          if (transceiver.rejected) {
            return resolve();
          }
          var cand = Object.keys(candidate.candidate).length > 0 ?
              SDPUtils.parseCandidate(candidate.candidate) : {};
          // Ignore Chrome's invalid candidates since Edge does not like them.
          if (cand.protocol === 'tcp' && (cand.port === 0 || cand.port === 9)) {
            return resolve();
          }
          // Ignore RTCP candidates, we assume RTCP-MUX.
          if (cand.component && cand.component !== 1) {
            return resolve();
          }
          // when using bundle, avoid adding candidates to the wrong
          // ice transport. And avoid adding candidates added in the SDP.
          if (sdpMLineIndex === 0 || (sdpMLineIndex > 0 &&
              transceiver.iceTransport !== pc.transceivers[0].iceTransport)) {
            if (!maybeAddCandidate(transceiver.iceTransport, cand)) {
              return reject(makeError('OperationError',
                  'Can not add ICE candidate'));
            }
          }

          // update the remoteDescription.
          var candidateString = candidate.candidate.trim();
          if (candidateString.indexOf('a=') === 0) {
            candidateString = candidateString.substr(2);
          }
          sections = SDPUtils.getMediaSections(pc._remoteDescription.sdp);
          sections[sdpMLineIndex] += 'a=' +
              (cand.type ? candidateString : 'end-of-candidates')
              + '\r\n';
          pc._remoteDescription.sdp =
              SDPUtils.getDescription(pc._remoteDescription.sdp) +
              sections.join('');
        } else {
          return reject(makeError('OperationError',
              'Can not add ICE candidate'));
        }
      }
      resolve();
    });
  };

  RTCPeerConnection.prototype.getStats = function(selector) {
    if (selector && selector instanceof window.MediaStreamTrack) {
      var senderOrReceiver = null;
      this.transceivers.forEach(function(transceiver) {
        if (transceiver.rtpSender &&
            transceiver.rtpSender.track === selector) {
          senderOrReceiver = transceiver.rtpSender;
        } else if (transceiver.rtpReceiver &&
            transceiver.rtpReceiver.track === selector) {
          senderOrReceiver = transceiver.rtpReceiver;
        }
      });
      if (!senderOrReceiver) {
        throw makeError('InvalidAccessError', 'Invalid selector.');
      }
      return senderOrReceiver.getStats();
    }

    var promises = [];
    this.transceivers.forEach(function(transceiver) {
      ['rtpSender', 'rtpReceiver', 'iceGatherer', 'iceTransport',
          'dtlsTransport'].forEach(function(method) {
            if (transceiver[method]) {
              promises.push(transceiver[method].getStats());
            }
          });
    });
    return Promise.all(promises).then(function(allStats) {
      var results = new Map();
      allStats.forEach(function(stats) {
        stats.forEach(function(stat) {
          results.set(stat.id, stat);
        });
      });
      return results;
    });
  };

  // fix low-level stat names and return Map instead of object.
  var ortcObjects = ['RTCRtpSender', 'RTCRtpReceiver', 'RTCIceGatherer',
    'RTCIceTransport', 'RTCDtlsTransport'];
  ortcObjects.forEach(function(ortcObjectName) {
    var obj = window[ortcObjectName];
    if (obj && obj.prototype && obj.prototype.getStats) {
      var nativeGetstats = obj.prototype.getStats;
      obj.prototype.getStats = function() {
        return nativeGetstats.apply(this)
        .then(function(nativeStats) {
          var mapStats = new Map();
          Object.keys(nativeStats).forEach(function(id) {
            nativeStats[id].type = fixStatsType(nativeStats[id]);
            mapStats.set(id, nativeStats[id]);
          });
          return mapStats;
        });
      };
    }
  });

  // legacy callback shims. Should be moved to adapter.js some days.
  var methods = ['createOffer', 'createAnswer'];
  methods.forEach(function(method) {
    var nativeMethod = RTCPeerConnection.prototype[method];
    RTCPeerConnection.prototype[method] = function() {
      var args = arguments;
      if (typeof args[0] === 'function' ||
          typeof args[1] === 'function') { // legacy
        return nativeMethod.apply(this, [arguments[2]])
        .then(function(description) {
          if (typeof args[0] === 'function') {
            args[0].apply(null, [description]);
          }
        }, function(error) {
          if (typeof args[1] === 'function') {
            args[1].apply(null, [error]);
          }
        });
      }
      return nativeMethod.apply(this, arguments);
    };
  });

  methods = ['setLocalDescription', 'setRemoteDescription', 'addIceCandidate'];
  methods.forEach(function(method) {
    var nativeMethod = RTCPeerConnection.prototype[method];
    RTCPeerConnection.prototype[method] = function() {
      var args = arguments;
      if (typeof args[1] === 'function' ||
          typeof args[2] === 'function') { // legacy
        return nativeMethod.apply(this, arguments)
        .then(function() {
          if (typeof args[1] === 'function') {
            args[1].apply(null);
          }
        }, function(error) {
          if (typeof args[2] === 'function') {
            args[2].apply(null, [error]);
          }
        });
      }
      return nativeMethod.apply(this, arguments);
    };
  });

  // getStats is special. It doesn't have a spec legacy method yet we support
  // getStats(something, cb) without error callbacks.
  ['getStats'].forEach(function(method) {
    var nativeMethod = RTCPeerConnection.prototype[method];
    RTCPeerConnection.prototype[method] = function() {
      var args = arguments;
      if (typeof args[1] === 'function') {
        return nativeMethod.apply(this, arguments)
        .then(function() {
          if (typeof args[1] === 'function') {
            args[1].apply(null);
          }
        });
      }
      return nativeMethod.apply(this, arguments);
    };
  });

  return RTCPeerConnection;
};

},{"sdp":49}],49:[function(require,module,exports){
 /* eslint-env node */
'use strict';

// SDP helpers.
var SDPUtils = {};

// Generate an alphanumeric identifier for cname or mids.
// TODO: use UUIDs instead? https://gist.github.com/jed/982883
SDPUtils.generateIdentifier = function() {
  return Math.random().toString(36).substr(2, 10);
};

// The RTCP CNAME used by all peerconnections from the same JS.
SDPUtils.localCName = SDPUtils.generateIdentifier();

// Splits SDP into lines, dealing with both CRLF and LF.
SDPUtils.splitLines = function(blob) {
  return blob.trim().split('\n').map(function(line) {
    return line.trim();
  });
};
// Splits SDP into sessionpart and mediasections. Ensures CRLF.
SDPUtils.splitSections = function(blob) {
  var parts = blob.split('\nm=');
  return parts.map(function(part, index) {
    return (index > 0 ? 'm=' + part : part).trim() + '\r\n';
  });
};

// returns the session description.
SDPUtils.getDescription = function(blob) {
  var sections = SDPUtils.splitSections(blob);
  return sections && sections[0];
};

// returns the individual media sections.
SDPUtils.getMediaSections = function(blob) {
  var sections = SDPUtils.splitSections(blob);
  sections.shift();
  return sections;
};

// Returns lines that start with a certain prefix.
SDPUtils.matchPrefix = function(blob, prefix) {
  return SDPUtils.splitLines(blob).filter(function(line) {
    return line.indexOf(prefix) === 0;
  });
};

// Parses an ICE candidate line. Sample input:
// candidate:702786350 2 udp 41819902 8.8.8.8 60769 typ relay raddr 8.8.8.8
// rport 55996"
SDPUtils.parseCandidate = function(line) {
  var parts;
  // Parse both variants.
  if (line.indexOf('a=candidate:') === 0) {
    parts = line.substring(12).split(' ');
  } else {
    parts = line.substring(10).split(' ');
  }

  var candidate = {
    foundation: parts[0],
    component: parseInt(parts[1], 10),
    protocol: parts[2].toLowerCase(),
    priority: parseInt(parts[3], 10),
    ip: parts[4],
    address: parts[4], // address is an alias for ip.
    port: parseInt(parts[5], 10),
    // skip parts[6] == 'typ'
    type: parts[7]
  };

  for (var i = 8; i < parts.length; i += 2) {
    switch (parts[i]) {
      case 'raddr':
        candidate.relatedAddress = parts[i + 1];
        break;
      case 'rport':
        candidate.relatedPort = parseInt(parts[i + 1], 10);
        break;
      case 'tcptype':
        candidate.tcpType = parts[i + 1];
        break;
      case 'ufrag':
        candidate.ufrag = parts[i + 1]; // for backward compability.
        candidate.usernameFragment = parts[i + 1];
        break;
      default: // extension handling, in particular ufrag
        candidate[parts[i]] = parts[i + 1];
        break;
    }
  }
  return candidate;
};

// Translates a candidate object into SDP candidate attribute.
SDPUtils.writeCandidate = function(candidate) {
  var sdp = [];
  sdp.push(candidate.foundation);
  sdp.push(candidate.component);
  sdp.push(candidate.protocol.toUpperCase());
  sdp.push(candidate.priority);
  sdp.push(candidate.address || candidate.ip);
  sdp.push(candidate.port);

  var type = candidate.type;
  sdp.push('typ');
  sdp.push(type);
  if (type !== 'host' && candidate.relatedAddress &&
      candidate.relatedPort) {
    sdp.push('raddr');
    sdp.push(candidate.relatedAddress);
    sdp.push('rport');
    sdp.push(candidate.relatedPort);
  }
  if (candidate.tcpType && candidate.protocol.toLowerCase() === 'tcp') {
    sdp.push('tcptype');
    sdp.push(candidate.tcpType);
  }
  if (candidate.usernameFragment || candidate.ufrag) {
    sdp.push('ufrag');
    sdp.push(candidate.usernameFragment || candidate.ufrag);
  }
  return 'candidate:' + sdp.join(' ');
};

// Parses an ice-options line, returns an array of option tags.
// a=ice-options:foo bar
SDPUtils.parseIceOptions = function(line) {
  return line.substr(14).split(' ');
};

// Parses an rtpmap line, returns RTCRtpCoddecParameters. Sample input:
// a=rtpmap:111 opus/48000/2
SDPUtils.parseRtpMap = function(line) {
  var parts = line.substr(9).split(' ');
  var parsed = {
    payloadType: parseInt(parts.shift(), 10) // was: id
  };

  parts = parts[0].split('/');

  parsed.name = parts[0];
  parsed.clockRate = parseInt(parts[1], 10); // was: clockrate
  parsed.channels = parts.length === 3 ? parseInt(parts[2], 10) : 1;
  // legacy alias, got renamed back to channels in ORTC.
  parsed.numChannels = parsed.channels;
  return parsed;
};

// Generate an a=rtpmap line from RTCRtpCodecCapability or
// RTCRtpCodecParameters.
SDPUtils.writeRtpMap = function(codec) {
  var pt = codec.payloadType;
  if (codec.preferredPayloadType !== undefined) {
    pt = codec.preferredPayloadType;
  }
  var channels = codec.channels || codec.numChannels || 1;
  return 'a=rtpmap:' + pt + ' ' + codec.name + '/' + codec.clockRate +
      (channels !== 1 ? '/' + channels : '') + '\r\n';
};

// Parses an a=extmap line (headerextension from RFC 5285). Sample input:
// a=extmap:2 urn:ietf:params:rtp-hdrext:toffset
// a=extmap:2/sendonly urn:ietf:params:rtp-hdrext:toffset
SDPUtils.parseExtmap = function(line) {
  var parts = line.substr(9).split(' ');
  return {
    id: parseInt(parts[0], 10),
    direction: parts[0].indexOf('/') > 0 ? parts[0].split('/')[1] : 'sendrecv',
    uri: parts[1]
  };
};

// Generates a=extmap line from RTCRtpHeaderExtensionParameters or
// RTCRtpHeaderExtension.
SDPUtils.writeExtmap = function(headerExtension) {
  return 'a=extmap:' + (headerExtension.id || headerExtension.preferredId) +
      (headerExtension.direction && headerExtension.direction !== 'sendrecv'
          ? '/' + headerExtension.direction
          : '') +
      ' ' + headerExtension.uri + '\r\n';
};

// Parses an ftmp line, returns dictionary. Sample input:
// a=fmtp:96 vbr=on;cng=on
// Also deals with vbr=on; cng=on
SDPUtils.parseFmtp = function(line) {
  var parsed = {};
  var kv;
  var parts = line.substr(line.indexOf(' ') + 1).split(';');
  for (var j = 0; j < parts.length; j++) {
    kv = parts[j].trim().split('=');
    parsed[kv[0].trim()] = kv[1];
  }
  return parsed;
};

// Generates an a=ftmp line from RTCRtpCodecCapability or RTCRtpCodecParameters.
SDPUtils.writeFmtp = function(codec) {
  var line = '';
  var pt = codec.payloadType;
  if (codec.preferredPayloadType !== undefined) {
    pt = codec.preferredPayloadType;
  }
  if (codec.parameters && Object.keys(codec.parameters).length) {
    var params = [];
    Object.keys(codec.parameters).forEach(function(param) {
      if (codec.parameters[param]) {
        params.push(param + '=' + codec.parameters[param]);
      } else {
        params.push(param);
      }
    });
    line += 'a=fmtp:' + pt + ' ' + params.join(';') + '\r\n';
  }
  return line;
};

// Parses an rtcp-fb line, returns RTCPRtcpFeedback object. Sample input:
// a=rtcp-fb:98 nack rpsi
SDPUtils.parseRtcpFb = function(line) {
  var parts = line.substr(line.indexOf(' ') + 1).split(' ');
  return {
    type: parts.shift(),
    parameter: parts.join(' ')
  };
};
// Generate a=rtcp-fb lines from RTCRtpCodecCapability or RTCRtpCodecParameters.
SDPUtils.writeRtcpFb = function(codec) {
  var lines = '';
  var pt = codec.payloadType;
  if (codec.preferredPayloadType !== undefined) {
    pt = codec.preferredPayloadType;
  }
  if (codec.rtcpFeedback && codec.rtcpFeedback.length) {
    // FIXME: special handling for trr-int?
    codec.rtcpFeedback.forEach(function(fb) {
      lines += 'a=rtcp-fb:' + pt + ' ' + fb.type +
      (fb.parameter && fb.parameter.length ? ' ' + fb.parameter : '') +
          '\r\n';
    });
  }
  return lines;
};

// Parses an RFC 5576 ssrc media attribute. Sample input:
// a=ssrc:3735928559 cname:something
SDPUtils.parseSsrcMedia = function(line) {
  var sp = line.indexOf(' ');
  var parts = {
    ssrc: parseInt(line.substr(7, sp - 7), 10)
  };
  var colon = line.indexOf(':', sp);
  if (colon > -1) {
    parts.attribute = line.substr(sp + 1, colon - sp - 1);
    parts.value = line.substr(colon + 1);
  } else {
    parts.attribute = line.substr(sp + 1);
  }
  return parts;
};

SDPUtils.parseSsrcGroup = function(line) {
  var parts = line.substr(13).split(' ');
  return {
    semantics: parts.shift(),
    ssrcs: parts.map(function(ssrc) {
      return parseInt(ssrc, 10);
    })
  };
};

// Extracts the MID (RFC 5888) from a media section.
// returns the MID or undefined if no mid line was found.
SDPUtils.getMid = function(mediaSection) {
  var mid = SDPUtils.matchPrefix(mediaSection, 'a=mid:')[0];
  if (mid) {
    return mid.substr(6);
  }
};

SDPUtils.parseFingerprint = function(line) {
  var parts = line.substr(14).split(' ');
  return {
    algorithm: parts[0].toLowerCase(), // algorithm is case-sensitive in Edge.
    value: parts[1]
  };
};

// Extracts DTLS parameters from SDP media section or sessionpart.
// FIXME: for consistency with other functions this should only
//   get the fingerprint line as input. See also getIceParameters.
SDPUtils.getDtlsParameters = function(mediaSection, sessionpart) {
  var lines = SDPUtils.matchPrefix(mediaSection + sessionpart,
      'a=fingerprint:');
  // Note: a=setup line is ignored since we use the 'auto' role.
  // Note2: 'algorithm' is not case sensitive except in Edge.
  return {
    role: 'auto',
    fingerprints: lines.map(SDPUtils.parseFingerprint)
  };
};

// Serializes DTLS parameters to SDP.
SDPUtils.writeDtlsParameters = function(params, setupType) {
  var sdp = 'a=setup:' + setupType + '\r\n';
  params.fingerprints.forEach(function(fp) {
    sdp += 'a=fingerprint:' + fp.algorithm + ' ' + fp.value + '\r\n';
  });
  return sdp;
};
// Parses ICE information from SDP media section or sessionpart.
// FIXME: for consistency with other functions this should only
//   get the ice-ufrag and ice-pwd lines as input.
SDPUtils.getIceParameters = function(mediaSection, sessionpart) {
  var lines = SDPUtils.splitLines(mediaSection);
  // Search in session part, too.
  lines = lines.concat(SDPUtils.splitLines(sessionpart));
  var iceParameters = {
    usernameFragment: lines.filter(function(line) {
      return line.indexOf('a=ice-ufrag:') === 0;
    })[0].substr(12),
    password: lines.filter(function(line) {
      return line.indexOf('a=ice-pwd:') === 0;
    })[0].substr(10)
  };
  return iceParameters;
};

// Serializes ICE parameters to SDP.
SDPUtils.writeIceParameters = function(params) {
  return 'a=ice-ufrag:' + params.usernameFragment + '\r\n' +
      'a=ice-pwd:' + params.password + '\r\n';
};

// Parses the SDP media section and returns RTCRtpParameters.
SDPUtils.parseRtpParameters = function(mediaSection) {
  var description = {
    codecs: [],
    headerExtensions: [],
    fecMechanisms: [],
    rtcp: []
  };
  var lines = SDPUtils.splitLines(mediaSection);
  var mline = lines[0].split(' ');
  for (var i = 3; i < mline.length; i++) { // find all codecs from mline[3..]
    var pt = mline[i];
    var rtpmapline = SDPUtils.matchPrefix(
        mediaSection, 'a=rtpmap:' + pt + ' ')[0];
    if (rtpmapline) {
      var codec = SDPUtils.parseRtpMap(rtpmapline);
      var fmtps = SDPUtils.matchPrefix(
          mediaSection, 'a=fmtp:' + pt + ' ');
      // Only the first a=fmtp:<pt> is considered.
      codec.parameters = fmtps.length ? SDPUtils.parseFmtp(fmtps[0]) : {};
      codec.rtcpFeedback = SDPUtils.matchPrefix(
          mediaSection, 'a=rtcp-fb:' + pt + ' ')
        .map(SDPUtils.parseRtcpFb);
      description.codecs.push(codec);
      // parse FEC mechanisms from rtpmap lines.
      switch (codec.name.toUpperCase()) {
        case 'RED':
        case 'ULPFEC':
          description.fecMechanisms.push(codec.name.toUpperCase());
          break;
        default: // only RED and ULPFEC are recognized as FEC mechanisms.
          break;
      }
    }
  }
  SDPUtils.matchPrefix(mediaSection, 'a=extmap:').forEach(function(line) {
    description.headerExtensions.push(SDPUtils.parseExtmap(line));
  });
  // FIXME: parse rtcp.
  return description;
};

// Generates parts of the SDP media section describing the capabilities /
// parameters.
SDPUtils.writeRtpDescription = function(kind, caps) {
  var sdp = '';

  // Build the mline.
  sdp += 'm=' + kind + ' ';
  sdp += caps.codecs.length > 0 ? '9' : '0'; // reject if no codecs.
  sdp += ' UDP/TLS/RTP/SAVPF ';
  sdp += caps.codecs.map(function(codec) {
    if (codec.preferredPayloadType !== undefined) {
      return codec.preferredPayloadType;
    }
    return codec.payloadType;
  }).join(' ') + '\r\n';

  sdp += 'c=IN IP4 0.0.0.0\r\n';
  sdp += 'a=rtcp:9 IN IP4 0.0.0.0\r\n';

  // Add a=rtpmap lines for each codec. Also fmtp and rtcp-fb.
  caps.codecs.forEach(function(codec) {
    sdp += SDPUtils.writeRtpMap(codec);
    sdp += SDPUtils.writeFmtp(codec);
    sdp += SDPUtils.writeRtcpFb(codec);
  });
  var maxptime = 0;
  caps.codecs.forEach(function(codec) {
    if (codec.maxptime > maxptime) {
      maxptime = codec.maxptime;
    }
  });
  if (maxptime > 0) {
    sdp += 'a=maxptime:' + maxptime + '\r\n';
  }
  sdp += 'a=rtcp-mux\r\n';

  if (caps.headerExtensions) {
    caps.headerExtensions.forEach(function(extension) {
      sdp += SDPUtils.writeExtmap(extension);
    });
  }
  // FIXME: write fecMechanisms.
  return sdp;
};

// Parses the SDP media section and returns an array of
// RTCRtpEncodingParameters.
SDPUtils.parseRtpEncodingParameters = function(mediaSection) {
  var encodingParameters = [];
  var description = SDPUtils.parseRtpParameters(mediaSection);
  var hasRed = description.fecMechanisms.indexOf('RED') !== -1;
  var hasUlpfec = description.fecMechanisms.indexOf('ULPFEC') !== -1;

  // filter a=ssrc:... cname:, ignore PlanB-msid
  var ssrcs = SDPUtils.matchPrefix(mediaSection, 'a=ssrc:')
  .map(function(line) {
    return SDPUtils.parseSsrcMedia(line);
  })
  .filter(function(parts) {
    return parts.attribute === 'cname';
  });
  var primarySsrc = ssrcs.length > 0 && ssrcs[0].ssrc;
  var secondarySsrc;

  var flows = SDPUtils.matchPrefix(mediaSection, 'a=ssrc-group:FID')
  .map(function(line) {
    var parts = line.substr(17).split(' ');
    return parts.map(function(part) {
      return parseInt(part, 10);
    });
  });
  if (flows.length > 0 && flows[0].length > 1 && flows[0][0] === primarySsrc) {
    secondarySsrc = flows[0][1];
  }

  description.codecs.forEach(function(codec) {
    if (codec.name.toUpperCase() === 'RTX' && codec.parameters.apt) {
      var encParam = {
        ssrc: primarySsrc,
        codecPayloadType: parseInt(codec.parameters.apt, 10)
      };
      if (primarySsrc && secondarySsrc) {
        encParam.rtx = {ssrc: secondarySsrc};
      }
      encodingParameters.push(encParam);
      if (hasRed) {
        encParam = JSON.parse(JSON.stringify(encParam));
        encParam.fec = {
          ssrc: primarySsrc,
          mechanism: hasUlpfec ? 'red+ulpfec' : 'red'
        };
        encodingParameters.push(encParam);
      }
    }
  });
  if (encodingParameters.length === 0 && primarySsrc) {
    encodingParameters.push({
      ssrc: primarySsrc
    });
  }

  // we support both b=AS and b=TIAS but interpret AS as TIAS.
  var bandwidth = SDPUtils.matchPrefix(mediaSection, 'b=');
  if (bandwidth.length) {
    if (bandwidth[0].indexOf('b=TIAS:') === 0) {
      bandwidth = parseInt(bandwidth[0].substr(7), 10);
    } else if (bandwidth[0].indexOf('b=AS:') === 0) {
      // use formula from JSEP to convert b=AS to TIAS value.
      bandwidth = parseInt(bandwidth[0].substr(5), 10) * 1000 * 0.95
          - (50 * 40 * 8);
    } else {
      bandwidth = undefined;
    }
    encodingParameters.forEach(function(params) {
      params.maxBitrate = bandwidth;
    });
  }
  return encodingParameters;
};

// parses http://draft.ortc.org/#rtcrtcpparameters*
SDPUtils.parseRtcpParameters = function(mediaSection) {
  var rtcpParameters = {};

  // Gets the first SSRC. Note tha with RTX there might be multiple
  // SSRCs.
  var remoteSsrc = SDPUtils.matchPrefix(mediaSection, 'a=ssrc:')
      .map(function(line) {
        return SDPUtils.parseSsrcMedia(line);
      })
      .filter(function(obj) {
        return obj.attribute === 'cname';
      })[0];
  if (remoteSsrc) {
    rtcpParameters.cname = remoteSsrc.value;
    rtcpParameters.ssrc = remoteSsrc.ssrc;
  }

  // Edge uses the compound attribute instead of reducedSize
  // compound is !reducedSize
  var rsize = SDPUtils.matchPrefix(mediaSection, 'a=rtcp-rsize');
  rtcpParameters.reducedSize = rsize.length > 0;
  rtcpParameters.compound = rsize.length === 0;

  // parses the rtcp-mux attrіbute.
  // Note that Edge does not support unmuxed RTCP.
  var mux = SDPUtils.matchPrefix(mediaSection, 'a=rtcp-mux');
  rtcpParameters.mux = mux.length > 0;

  return rtcpParameters;
};

// parses either a=msid: or a=ssrc:... msid lines and returns
// the id of the MediaStream and MediaStreamTrack.
SDPUtils.parseMsid = function(mediaSection) {
  var parts;
  var spec = SDPUtils.matchPrefix(mediaSection, 'a=msid:');
  if (spec.length === 1) {
    parts = spec[0].substr(7).split(' ');
    return {stream: parts[0], track: parts[1]};
  }
  var planB = SDPUtils.matchPrefix(mediaSection, 'a=ssrc:')
  .map(function(line) {
    return SDPUtils.parseSsrcMedia(line);
  })
  .filter(function(msidParts) {
    return msidParts.attribute === 'msid';
  });
  if (planB.length > 0) {
    parts = planB[0].value.split(' ');
    return {stream: parts[0], track: parts[1]};
  }
};

// Generate a session ID for SDP.
// https://tools.ietf.org/html/draft-ietf-rtcweb-jsep-20#section-5.2.1
// recommends using a cryptographically random +ve 64-bit value
// but right now this should be acceptable and within the right range
SDPUtils.generateSessionId = function() {
  return Math.random().toString().substr(2, 21);
};

// Write boilder plate for start of SDP
// sessId argument is optional - if not supplied it will
// be generated randomly
// sessVersion is optional and defaults to 2
// sessUser is optional and defaults to 'thisisadapterortc'
SDPUtils.writeSessionBoilerplate = function(sessId, sessVer, sessUser) {
  var sessionId;
  var version = sessVer !== undefined ? sessVer : 2;
  if (sessId) {
    sessionId = sessId;
  } else {
    sessionId = SDPUtils.generateSessionId();
  }
  var user = sessUser || 'thisisadapterortc';
  // FIXME: sess-id should be an NTP timestamp.
  return 'v=0\r\n' +
      'o=' + user + ' ' + sessionId + ' ' + version +
        ' IN IP4 127.0.0.1\r\n' +
      's=-\r\n' +
      't=0 0\r\n';
};

SDPUtils.writeMediaSection = function(transceiver, caps, type, stream) {
  var sdp = SDPUtils.writeRtpDescription(transceiver.kind, caps);

  // Map ICE parameters (ufrag, pwd) to SDP.
  sdp += SDPUtils.writeIceParameters(
      transceiver.iceGatherer.getLocalParameters());

  // Map DTLS parameters to SDP.
  sdp += SDPUtils.writeDtlsParameters(
      transceiver.dtlsTransport.getLocalParameters(),
      type === 'offer' ? 'actpass' : 'active');

  sdp += 'a=mid:' + transceiver.mid + '\r\n';

  if (transceiver.direction) {
    sdp += 'a=' + transceiver.direction + '\r\n';
  } else if (transceiver.rtpSender && transceiver.rtpReceiver) {
    sdp += 'a=sendrecv\r\n';
  } else if (transceiver.rtpSender) {
    sdp += 'a=sendonly\r\n';
  } else if (transceiver.rtpReceiver) {
    sdp += 'a=recvonly\r\n';
  } else {
    sdp += 'a=inactive\r\n';
  }

  if (transceiver.rtpSender) {
    // spec.
    var msid = 'msid:' + stream.id + ' ' +
        transceiver.rtpSender.track.id + '\r\n';
    sdp += 'a=' + msid;

    // for Chrome.
    sdp += 'a=ssrc:' + transceiver.sendEncodingParameters[0].ssrc +
        ' ' + msid;
    if (transceiver.sendEncodingParameters[0].rtx) {
      sdp += 'a=ssrc:' + transceiver.sendEncodingParameters[0].rtx.ssrc +
          ' ' + msid;
      sdp += 'a=ssrc-group:FID ' +
          transceiver.sendEncodingParameters[0].ssrc + ' ' +
          transceiver.sendEncodingParameters[0].rtx.ssrc +
          '\r\n';
    }
  }
  // FIXME: this should be written by writeRtpDescription.
  sdp += 'a=ssrc:' + transceiver.sendEncodingParameters[0].ssrc +
      ' cname:' + SDPUtils.localCName + '\r\n';
  if (transceiver.rtpSender && transceiver.sendEncodingParameters[0].rtx) {
    sdp += 'a=ssrc:' + transceiver.sendEncodingParameters[0].rtx.ssrc +
        ' cname:' + SDPUtils.localCName + '\r\n';
  }
  return sdp;
};

// Gets the direction from the mediaSection or the sessionpart.
SDPUtils.getDirection = function(mediaSection, sessionpart) {
  // Look for sendrecv, sendonly, recvonly, inactive, default to sendrecv.
  var lines = SDPUtils.splitLines(mediaSection);
  for (var i = 0; i < lines.length; i++) {
    switch (lines[i]) {
      case 'a=sendrecv':
      case 'a=sendonly':
      case 'a=recvonly':
      case 'a=inactive':
        return lines[i].substr(2);
      default:
        // FIXME: What should happen here?
    }
  }
  if (sessionpart) {
    return SDPUtils.getDirection(sessionpart);
  }
  return 'sendrecv';
};

SDPUtils.getKind = function(mediaSection) {
  var lines = SDPUtils.splitLines(mediaSection);
  var mline = lines[0].split(' ');
  return mline[0].substr(2);
};

SDPUtils.isRejected = function(mediaSection) {
  return mediaSection.split(' ', 2)[1] === '0';
};

SDPUtils.parseMLine = function(mediaSection) {
  var lines = SDPUtils.splitLines(mediaSection);
  var parts = lines[0].substr(2).split(' ');
  return {
    kind: parts[0],
    port: parseInt(parts[1], 10),
    protocol: parts[2],
    fmt: parts.slice(3).join(' ')
  };
};

SDPUtils.parseOLine = function(mediaSection) {
  var line = SDPUtils.matchPrefix(mediaSection, 'o=')[0];
  var parts = line.substr(2).split(' ');
  return {
    username: parts[0],
    sessionId: parts[1],
    sessionVersion: parseInt(parts[2], 10),
    netType: parts[3],
    addressType: parts[4],
    address: parts[5]
  };
};

// a very naive interpretation of a valid SDP.
SDPUtils.isValidSDP = function(blob) {
  if (typeof blob !== 'string' || blob.length === 0) {
    return false;
  }
  var lines = SDPUtils.splitLines(blob);
  for (var i = 0; i < lines.length; i++) {
    if (lines[i].length < 2 || lines[i].charAt(1) !== '=') {
      return false;
    }
    // TODO: check the modifier a bit more.
  }
  return true;
};

// Expose public methods.
if (typeof module === 'object') {
  module.exports = SDPUtils;
}

},{}],50:[function(require,module,exports){
module.exports = function isBuffer(arg) {
  return arg && typeof arg === 'object'
    && typeof arg.copy === 'function'
    && typeof arg.fill === 'function'
    && typeof arg.readUInt8 === 'function';
}
},{}],51:[function(require,module,exports){
(function (process,global){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var formatRegExp = /%[sdj%]/g;
exports.format = function(f) {
  if (!isString(f)) {
    var objects = [];
    for (var i = 0; i < arguments.length; i++) {
      objects.push(inspect(arguments[i]));
    }
    return objects.join(' ');
  }

  var i = 1;
  var args = arguments;
  var len = args.length;
  var str = String(f).replace(formatRegExp, function(x) {
    if (x === '%%') return '%';
    if (i >= len) return x;
    switch (x) {
      case '%s': return String(args[i++]);
      case '%d': return Number(args[i++]);
      case '%j':
        try {
          return JSON.stringify(args[i++]);
        } catch (_) {
          return '[Circular]';
        }
      default:
        return x;
    }
  });
  for (var x = args[i]; i < len; x = args[++i]) {
    if (isNull(x) || !isObject(x)) {
      str += ' ' + x;
    } else {
      str += ' ' + inspect(x);
    }
  }
  return str;
};


// Mark that a method should not be used.
// Returns a modified function which warns once by default.
// If --no-deprecation is set, then it is a no-op.
exports.deprecate = function(fn, msg) {
  // Allow for deprecating things in the process of starting up.
  if (isUndefined(global.process)) {
    return function() {
      return exports.deprecate(fn, msg).apply(this, arguments);
    };
  }

  if (process.noDeprecation === true) {
    return fn;
  }

  var warned = false;
  function deprecated() {
    if (!warned) {
      if (process.throwDeprecation) {
        throw new Error(msg);
      } else if (process.traceDeprecation) {
        console.trace(msg);
      } else {
        console.error(msg);
      }
      warned = true;
    }
    return fn.apply(this, arguments);
  }

  return deprecated;
};


var debugs = {};
var debugEnviron;
exports.debuglog = function(set) {
  if (isUndefined(debugEnviron))
    debugEnviron = process.env.NODE_DEBUG || '';
  set = set.toUpperCase();
  if (!debugs[set]) {
    if (new RegExp('\\b' + set + '\\b', 'i').test(debugEnviron)) {
      var pid = process.pid;
      debugs[set] = function() {
        var msg = exports.format.apply(exports, arguments);
        console.error('%s %d: %s', set, pid, msg);
      };
    } else {
      debugs[set] = function() {};
    }
  }
  return debugs[set];
};


/**
 * Echos the value of a value. Trys to print the value out
 * in the best way possible given the different types.
 *
 * @param {Object} obj The object to print out.
 * @param {Object} opts Optional options object that alters the output.
 */
/* legacy: obj, showHidden, depth, colors*/
function inspect(obj, opts) {
  // default options
  var ctx = {
    seen: [],
    stylize: stylizeNoColor
  };
  // legacy...
  if (arguments.length >= 3) ctx.depth = arguments[2];
  if (arguments.length >= 4) ctx.colors = arguments[3];
  if (isBoolean(opts)) {
    // legacy...
    ctx.showHidden = opts;
  } else if (opts) {
    // got an "options" object
    exports._extend(ctx, opts);
  }
  // set default options
  if (isUndefined(ctx.showHidden)) ctx.showHidden = false;
  if (isUndefined(ctx.depth)) ctx.depth = 2;
  if (isUndefined(ctx.colors)) ctx.colors = false;
  if (isUndefined(ctx.customInspect)) ctx.customInspect = true;
  if (ctx.colors) ctx.stylize = stylizeWithColor;
  return formatValue(ctx, obj, ctx.depth);
}
exports.inspect = inspect;


// http://en.wikipedia.org/wiki/ANSI_escape_code#graphics
inspect.colors = {
  'bold' : [1, 22],
  'italic' : [3, 23],
  'underline' : [4, 24],
  'inverse' : [7, 27],
  'white' : [37, 39],
  'grey' : [90, 39],
  'black' : [30, 39],
  'blue' : [34, 39],
  'cyan' : [36, 39],
  'green' : [32, 39],
  'magenta' : [35, 39],
  'red' : [31, 39],
  'yellow' : [33, 39]
};

// Don't use 'blue' not visible on cmd.exe
inspect.styles = {
  'special': 'cyan',
  'number': 'yellow',
  'boolean': 'yellow',
  'undefined': 'grey',
  'null': 'bold',
  'string': 'green',
  'date': 'magenta',
  // "name": intentionally not styling
  'regexp': 'red'
};


function stylizeWithColor(str, styleType) {
  var style = inspect.styles[styleType];

  if (style) {
    return '\u001b[' + inspect.colors[style][0] + 'm' + str +
           '\u001b[' + inspect.colors[style][1] + 'm';
  } else {
    return str;
  }
}


function stylizeNoColor(str, styleType) {
  return str;
}


function arrayToHash(array) {
  var hash = {};

  array.forEach(function(val, idx) {
    hash[val] = true;
  });

  return hash;
}


function formatValue(ctx, value, recurseTimes) {
  // Provide a hook for user-specified inspect functions.
  // Check that value is an object with an inspect function on it
  if (ctx.customInspect &&
      value &&
      isFunction(value.inspect) &&
      // Filter out the util module, it's inspect function is special
      value.inspect !== exports.inspect &&
      // Also filter out any prototype objects using the circular check.
      !(value.constructor && value.constructor.prototype === value)) {
    var ret = value.inspect(recurseTimes, ctx);
    if (!isString(ret)) {
      ret = formatValue(ctx, ret, recurseTimes);
    }
    return ret;
  }

  // Primitive types cannot have properties
  var primitive = formatPrimitive(ctx, value);
  if (primitive) {
    return primitive;
  }

  // Look up the keys of the object.
  var keys = Object.keys(value);
  var visibleKeys = arrayToHash(keys);

  if (ctx.showHidden) {
    keys = Object.getOwnPropertyNames(value);
  }

  // IE doesn't make error fields non-enumerable
  // http://msdn.microsoft.com/en-us/library/ie/dww52sbt(v=vs.94).aspx
  if (isError(value)
      && (keys.indexOf('message') >= 0 || keys.indexOf('description') >= 0)) {
    return formatError(value);
  }

  // Some type of object without properties can be shortcutted.
  if (keys.length === 0) {
    if (isFunction(value)) {
      var name = value.name ? ': ' + value.name : '';
      return ctx.stylize('[Function' + name + ']', 'special');
    }
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    }
    if (isDate(value)) {
      return ctx.stylize(Date.prototype.toString.call(value), 'date');
    }
    if (isError(value)) {
      return formatError(value);
    }
  }

  var base = '', array = false, braces = ['{', '}'];

  // Make Array say that they are Array
  if (isArray(value)) {
    array = true;
    braces = ['[', ']'];
  }

  // Make functions say that they are functions
  if (isFunction(value)) {
    var n = value.name ? ': ' + value.name : '';
    base = ' [Function' + n + ']';
  }

  // Make RegExps say that they are RegExps
  if (isRegExp(value)) {
    base = ' ' + RegExp.prototype.toString.call(value);
  }

  // Make dates with properties first say the date
  if (isDate(value)) {
    base = ' ' + Date.prototype.toUTCString.call(value);
  }

  // Make error with message first say the error
  if (isError(value)) {
    base = ' ' + formatError(value);
  }

  if (keys.length === 0 && (!array || value.length == 0)) {
    return braces[0] + base + braces[1];
  }

  if (recurseTimes < 0) {
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    } else {
      return ctx.stylize('[Object]', 'special');
    }
  }

  ctx.seen.push(value);

  var output;
  if (array) {
    output = formatArray(ctx, value, recurseTimes, visibleKeys, keys);
  } else {
    output = keys.map(function(key) {
      return formatProperty(ctx, value, recurseTimes, visibleKeys, key, array);
    });
  }

  ctx.seen.pop();

  return reduceToSingleString(output, base, braces);
}


function formatPrimitive(ctx, value) {
  if (isUndefined(value))
    return ctx.stylize('undefined', 'undefined');
  if (isString(value)) {
    var simple = '\'' + JSON.stringify(value).replace(/^"|"$/g, '')
                                             .replace(/'/g, "\\'")
                                             .replace(/\\"/g, '"') + '\'';
    return ctx.stylize(simple, 'string');
  }
  if (isNumber(value))
    return ctx.stylize('' + value, 'number');
  if (isBoolean(value))
    return ctx.stylize('' + value, 'boolean');
  // For some reason typeof null is "object", so special case here.
  if (isNull(value))
    return ctx.stylize('null', 'null');
}


function formatError(value) {
  return '[' + Error.prototype.toString.call(value) + ']';
}


function formatArray(ctx, value, recurseTimes, visibleKeys, keys) {
  var output = [];
  for (var i = 0, l = value.length; i < l; ++i) {
    if (hasOwnProperty(value, String(i))) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          String(i), true));
    } else {
      output.push('');
    }
  }
  keys.forEach(function(key) {
    if (!key.match(/^\d+$/)) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          key, true));
    }
  });
  return output;
}


function formatProperty(ctx, value, recurseTimes, visibleKeys, key, array) {
  var name, str, desc;
  desc = Object.getOwnPropertyDescriptor(value, key) || { value: value[key] };
  if (desc.get) {
    if (desc.set) {
      str = ctx.stylize('[Getter/Setter]', 'special');
    } else {
      str = ctx.stylize('[Getter]', 'special');
    }
  } else {
    if (desc.set) {
      str = ctx.stylize('[Setter]', 'special');
    }
  }
  if (!hasOwnProperty(visibleKeys, key)) {
    name = '[' + key + ']';
  }
  if (!str) {
    if (ctx.seen.indexOf(desc.value) < 0) {
      if (isNull(recurseTimes)) {
        str = formatValue(ctx, desc.value, null);
      } else {
        str = formatValue(ctx, desc.value, recurseTimes - 1);
      }
      if (str.indexOf('\n') > -1) {
        if (array) {
          str = str.split('\n').map(function(line) {
            return '  ' + line;
          }).join('\n').substr(2);
        } else {
          str = '\n' + str.split('\n').map(function(line) {
            return '   ' + line;
          }).join('\n');
        }
      }
    } else {
      str = ctx.stylize('[Circular]', 'special');
    }
  }
  if (isUndefined(name)) {
    if (array && key.match(/^\d+$/)) {
      return str;
    }
    name = JSON.stringify('' + key);
    if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
      name = name.substr(1, name.length - 2);
      name = ctx.stylize(name, 'name');
    } else {
      name = name.replace(/'/g, "\\'")
                 .replace(/\\"/g, '"')
                 .replace(/(^"|"$)/g, "'");
      name = ctx.stylize(name, 'string');
    }
  }

  return name + ': ' + str;
}


function reduceToSingleString(output, base, braces) {
  var numLinesEst = 0;
  var length = output.reduce(function(prev, cur) {
    numLinesEst++;
    if (cur.indexOf('\n') >= 0) numLinesEst++;
    return prev + cur.replace(/\u001b\[\d\d?m/g, '').length + 1;
  }, 0);

  if (length > 60) {
    return braces[0] +
           (base === '' ? '' : base + '\n ') +
           ' ' +
           output.join(',\n  ') +
           ' ' +
           braces[1];
  }

  return braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];
}


// NOTE: These type checking functions intentionally don't use `instanceof`
// because it is fragile and can be easily faked with `Object.create()`.
function isArray(ar) {
  return Array.isArray(ar);
}
exports.isArray = isArray;

function isBoolean(arg) {
  return typeof arg === 'boolean';
}
exports.isBoolean = isBoolean;

function isNull(arg) {
  return arg === null;
}
exports.isNull = isNull;

function isNullOrUndefined(arg) {
  return arg == null;
}
exports.isNullOrUndefined = isNullOrUndefined;

function isNumber(arg) {
  return typeof arg === 'number';
}
exports.isNumber = isNumber;

function isString(arg) {
  return typeof arg === 'string';
}
exports.isString = isString;

function isSymbol(arg) {
  return typeof arg === 'symbol';
}
exports.isSymbol = isSymbol;

function isUndefined(arg) {
  return arg === void 0;
}
exports.isUndefined = isUndefined;

function isRegExp(re) {
  return isObject(re) && objectToString(re) === '[object RegExp]';
}
exports.isRegExp = isRegExp;

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}
exports.isObject = isObject;

function isDate(d) {
  return isObject(d) && objectToString(d) === '[object Date]';
}
exports.isDate = isDate;

function isError(e) {
  return isObject(e) &&
      (objectToString(e) === '[object Error]' || e instanceof Error);
}
exports.isError = isError;

function isFunction(arg) {
  return typeof arg === 'function';
}
exports.isFunction = isFunction;

function isPrimitive(arg) {
  return arg === null ||
         typeof arg === 'boolean' ||
         typeof arg === 'number' ||
         typeof arg === 'string' ||
         typeof arg === 'symbol' ||  // ES6 symbol
         typeof arg === 'undefined';
}
exports.isPrimitive = isPrimitive;

exports.isBuffer = require('./support/isBuffer');

function objectToString(o) {
  return Object.prototype.toString.call(o);
}


function pad(n) {
  return n < 10 ? '0' + n.toString(10) : n.toString(10);
}


var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',
              'Oct', 'Nov', 'Dec'];

// 26 Feb 16:19:34
function timestamp() {
  var d = new Date();
  var time = [pad(d.getHours()),
              pad(d.getMinutes()),
              pad(d.getSeconds())].join(':');
  return [d.getDate(), months[d.getMonth()], time].join(' ');
}


// log is just a thin wrapper to console.log that prepends a timestamp
exports.log = function() {
  console.log('%s - %s', timestamp(), exports.format.apply(exports, arguments));
};


/**
 * Inherit the prototype methods from one constructor into another.
 *
 * The Function.prototype.inherits from lang.js rewritten as a standalone
 * function (not on Function.prototype). NOTE: If this file is to be loaded
 * during bootstrapping this function needs to be rewritten using some native
 * functions as prototype setup using normal JavaScript does not work as
 * expected during bootstrapping (see mirror.js in r114903).
 *
 * @param {function} ctor Constructor function which needs to inherit the
 *     prototype.
 * @param {function} superCtor Constructor function to inherit prototype from.
 */
exports.inherits = require('inherits');

exports._extend = function(origin, add) {
  // Don't do anything if add isn't an object
  if (!add || !isObject(add)) return origin;

  var keys = Object.keys(add);
  var i = keys.length;
  while (i--) {
    origin[keys[i]] = add[keys[i]];
  }
  return origin;
};

function hasOwnProperty(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./support/isBuffer":50,"_process":45,"inherits":41}],52:[function(require,module,exports){
module.exports={
  "name": "twilio-client",
  "version": "1.6.1-dev",
  "description": "Javascript SDK for Twilio Client",
  "homepage": "https://www.twilio.com/docs/client/twilio-js",
  "main": "./es5/twilio.js",
  "license": "Apache-2.0",
  "repository": {
    "type": "git",
    "url": "git@code.hq.twilio.com:client/twiliojs.git"
  },
  "scripts": {
    "build": "npm-run-all clean docs:ts docs:js build:es5 build:ts build:dist build:dist-min",
    "build:es5": "rimraf ./es5 && babel lib -d es5",
    "build:dist": "node ./scripts/build.js ./lib/browser.js ./LICENSE.md ./dist/twilio.js",
    "build:dist-min": "uglifyjs ./dist/twilio.js -o ./dist/twilio.min.js --comments \"/^! twilio-client.js/\" -b beautify=false,ascii_only=true",
    "build:travis": "npm-run-all lint build test:unit test:integration test:webpack test:es5",
    "build:ts": "tsc",
    "clean": "rimraf ./coverage ./dist ./es5",
    "coverage": "nyc ./node_modules/mocha/bin/mocha -r ts-node/register ./tests/index.ts",
    "docs:js": "jsdoc -r -d dist/docs/js lib/twilio",
    "docs:ts": "typedoc --out dist/docs/ts lib/twilio",
    "extension": "browserify -t brfs extension/token/index.js > extension/token.js",
    "lint": "npm-run-all lint:js lint:ts",
    "lint:js": "eslint lib",
    "lint:ts": "tslint -c tslint.json --project tsconfig.json -t stylish",
    "release": "release",
    "start": "node server.js",
    "test": "npm-run-all test:unit test:frameworks",
    "test:es5": "es-check es5 \"./es5/**/*.js\" ./dist/*.js",
    "test:framework:no-framework": "mocha tests/framework/no-framework.js",
    "test:framework:react:install": "cd ./tests/framework/react && rimraf ./node_modules package-lock.json && npm install",
    "test:framework:react:build": "cd ./tests/framework/react && npm run build",
    "test:framework:react:run": "mocha ./tests/framework/react.js",
    "test:framework:react": "npm-run-all test:framework:react:*",
    "test:frameworks": "npm-run-all test:framework:no-framework test:framework:react",
    "test:integration": "karma start karma.conf.ts",
    "test:selenium": "mocha tests/browser/index.js",
    "test:unit": "mocha --reporter=spec -r ts-node/register ./tests/index.ts",
    "test:webpack": "cd ./tests/webpack && npm install && npm test"
  },
  "pre-commit": [
    "lint",
    "test:unit"
  ],
  "devDependencies": {
    "@types/mocha": "^5.0.0",
    "@types/node": "^9.6.5",
    "@types/sinon": "^5.0.1",
    "@types/ws": "^4.0.2",
    "babel-cli": "^6.26.0",
    "babel-eslint": "^8.2.2",
    "babel-plugin-envify": "^1.2.1",
    "babel-plugin-transform-class-properties": "^6.24.1",
    "babel-plugin-transform-inline-environment-variables": "^0.4.3",
    "babel-preset-es2015": "^6.24.1",
    "browserify": "^16.2.2",
    "buffer": "^5.2.0",
    "chromedriver": "^2.31.0",
    "envify": "2.0.1",
    "es-check": "^2.0.3",
    "eslint": "^4.19.1",
    "eslint-plugin-babel": "^4.1.2",
    "express": "^4.14.1",
    "geckodriver": "^1.8.1",
    "js-yaml": "^3.9.1",
    "jsdoc": "^3.5.5",
    "jsonwebtoken": "^7.4.3",
    "karma": "^3.0.0",
    "karma-chrome-launcher": "^2.2.0",
    "karma-firefox-launcher": "^1.1.0",
    "karma-mocha": "^1.3.0",
    "karma-safaritechpreview-launcher": "0.0.6",
    "karma-spec-reporter": "0.0.32",
    "karma-typescript": "^3.0.13",
    "karma-typescript-es6-transform": "^1.0.4",
    "lodash": "^4.17.4",
    "mocha": "^3.5.0",
    "npm-run-all": "^4.1.2",
    "nyc": "^10.1.2",
    "pre-commit": "^1.2.2",
    "querystring": "^0.2.0",
    "release-tool": "^0.2.2",
    "selenium-webdriver": "^3.5.0",
    "sinon": "^4.0.0",
    "travis-multirunner": "^4.5.0",
    "ts-node": "^6.0.0",
    "tslint": "^5.9.1",
    "twilio": "^3.17.0",
    "typedoc": "ryan-rowland/typedoc#twilio",
    "typedoc-plugin-as-member-of": "^1.0.2",
    "typescript": "^2.8.1",
    "uglify-js": "^3.3.11",
    "vinyl-fs": "^3.0.2",
    "vinyl-source-stream": "^2.0.0"
  },
  "dependencies": {
    "@twilio/audioplayer": "^1.0.3",
    "backoff": "^2.5.0",
    "rtcpeerconnection-shim": "^1.2.8",
    "ws": "0.4.31",
    "xmlhttprequest": "^1.8.0"
  },
  "browser": {
    "xmlhttprequest": "./browser/xmlhttprequest.js",
    "ws": "./browser/ws.js"
  }
}

},{}]},{},[3]);
;
  var Voice = bundle(3);
  /* globals define */
  if (typeof define === 'function' && define.amd) {
    define([], function() { return Voice; });
  } else {
    var Twilio = root.Twilio = root.Twilio || {};
    Twilio.Connection = Twilio.Connection || Voice.Connection;
    Twilio.Device = Twilio.Device || Voice.Device;
    Twilio.PStream = Twilio.PStream || Voice.PStream;
  }
})(typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
