odoo.define('mgb_tree_months.GanttView', function (require) {
    "use strict";
    var AbstractView = require('web.AbstractView');
    var core = require('web.core');
//var ajax = require('web.ajax');
//var qweb = core.qweb;
//ajax.loadXML('/mgb_tree_months/static/src/xml/gantview.xml', qweb);
"use strict";
    
var core = require('web.core');
var GanttModel = require('web_gantt.GanttModel');
var GanttRow = require('web_gantt.GanttRow');
var GanttView = require('web_gantt.GanttView');
var qweb = require('web.QWeb');
var config = require('web.config');
var session = require('web.session');

var utils = require('web.utils');
var GanttRenderer = require('web_gantt.GanttRenderer');
var GanttController = require('web_gantt.GanttController');
var pyUtils = require('web.py_utils');
var view_registry = require('web.view_registry');


var QWeb = core.qweb;
var _t = core._t;

GanttView.include({
   

    /**
     * @override
     */
    init: function (viewInfo, params) {
        this._super.apply(this, arguments);
console.log('1')
        this.SCALES = {
            day: { string: _t('Day'), cellPrecisions: { full: 60, half: 30, quarter: 15 }, defaultPrecision: 'full', time: 'minutes', interval: 'hour' },
            week: { string: _t('Week'), cellPrecisions: { full: 24, half: 12 }, defaultPrecision: 'half', time: 'hours', interval: 'day' },
            month: { string: _t('Month'), cellPrecisions: { full: 24, half: 12 }, defaultPrecision: 'half', time: 'hours', interval: 'day' },
            threemonth: { string: _t('3 Months'), cellPrecisions: { full: 24, half: 12 }, defaultPrecision: 'half', time: 'hours', interval: 'day' },
            year: { string: _t('Year'), cellPrecisions: { full: 1 }, defaultPrecision: 'full', time: 'months', interval: 'month' },
        };

        var arch = this.arch;
        console.log('2')

        // Decoration fields
        var decorationFields = [];
        _.each(arch.children, function (child) {
            if (child.tag === 'field') {
                decorationFields.push(child.attrs.name);
            }
        });
        console.log('3')

        var collapseFirstLevel = !!arch.attrs.collapse_first_level;

        // Unavailability
        var displayUnavailability = !!arch.attrs.display_unavailability;

        // Colors
        var colorField = arch.attrs.color;

        // Cell precision
        // precision = {'day': 'hour:half', 'week': 'day:half', 'month': 'day', 'year': 'month:quarter'}
        var precisionAttrs = arch.attrs.precision ? pyUtils.py_eval(arch.attrs.precision) : {};
        var cellPrecisions = {};
        _.each(this.SCALES, function (vals, key) {
            if (precisionAttrs[key]) {
                var precision = precisionAttrs[key].split(':'); // hour:half
                // Note that precision[0] (which is the cell interval) is not
                // taken into account right now because it is no customizable.
                if (precision[1] && _.contains(_.keys(vals.cellPrecisions), precision[1])) {
                    cellPrecisions[key] = precision[1];
                }
            }
            cellPrecisions[key] = cellPrecisions[key] || vals.defaultPrecision;
        });

        var consolidationMaxField;
        var consolidationMaxValue;
        var consolidationMax = arch.attrs.consolidation_max ? pyUtils.py_eval(arch.attrs.consolidation_max) : {};
        if (Object.keys(consolidationMax).length > 0) {
            consolidationMaxField = Object.keys(consolidationMax)[0];
            consolidationMaxValue = consolidationMax[consolidationMaxField];
            // We need to display the aggregates even if there is only one groupby
            collapseFirstLevel = !!consolidationMaxField || collapseFirstLevel;
        }

        var consolidationParams = {
            field: arch.attrs.consolidation,
            maxField: consolidationMaxField,
            maxValue: consolidationMaxValue,
            excludeField: arch.attrs.consolidation_exclude,
        };

        // form view which is opened by gantt
        var formViewId = arch.attrs.form_view_id ? parseInt(arch.attrs.form_view_id, 10) : false;
        if (params.action && !formViewId) { // fallback on form view action, or 'false'
            var result = _.findWhere(params.action.views, { type: 'form' });
            formViewId = result ? result.viewID : false;
        }
        var dialogViews = [[formViewId, 'form']];

        var allowedScales;
      
            allowedScales = Object.keys(this.SCALES);
        

        var scale = arch.attrs.default_scale || 'month';
        var initialDate = moment(params.initialDate || params.context.initialDate || new Date());
        var offset = arch.attrs.offset;
        if (offset && scale) {
            initialDate.add(offset, scale);
        }

        // thumbnails for groups (display a thumbnail next to the group name)
        var thumbnails = this.arch.attrs.thumbnails ? pyUtils.py_eval(this.arch.attrs.thumbnails) : {};
        // plan option
        var canPlan = this.arch.attrs.plan ? !!JSON.parse(this.arch.attrs.plan) : true;

        this.controllerParams.context = params.context || {};
        this.controllerParams.dialogViews = dialogViews;
        this.controllerParams.SCALES = this.SCALES;
        this.controllerParams.allowedScales = allowedScales;
        this.controllerParams.collapseFirstLevel = collapseFirstLevel;
        this.controllerParams.createAction = arch.attrs.on_create || null;

        this.loadParams.initialDate = initialDate;
        this.loadParams.collapseFirstLevel = collapseFirstLevel;
        this.loadParams.colorField = colorField;
        this.loadParams.dateStartField = arch.attrs.date_start;
        this.loadParams.dateStopField = arch.attrs.date_stop;
        this.loadParams.progressField = arch.attrs.progress;
        this.loadParams.decorationFields = decorationFields;
        this.loadParams.defaultGroupBy = this.arch.attrs.default_group_by;
        this.loadParams.displayUnavailability = displayUnavailability;
        this.loadParams.fields = this.fields;
        this.loadParams.scale = scale;
        this.loadParams.consolidationParams = consolidationParams;

        this.rendererParams.canCreate = this.controllerParams.activeActions.create;
        this.rendererParams.canEdit = this.controllerParams.activeActions.edit;
        this.rendererParams.canPlan = canPlan && this.rendererParams.canEdit;
        this.rendererParams.fieldsInfo = viewInfo.fields;
        this.rendererParams.SCALES = this.SCALES;
        this.rendererParams.cellPrecisions = cellPrecisions;
        this.rendererParams.totalRow = arch.attrs.total_row || false;
        this.rendererParams.string = arch.attrs.string || _t('Gantt View');
        this.rendererParams.popoverTemplate = _.findWhere(arch.children, {tag: 'templates'});
        this.rendererParams.colorField = colorField;
        this.rendererParams.progressField = arch.attrs.progress;
        this.rendererParams.displayUnavailability = displayUnavailability;
        this.rendererParams.collapseFirstLevel = collapseFirstLevel;
        this.rendererParams.consolidationParams = consolidationParams;
        this.rendererParams.thumbnails = thumbnails;
        console.log(this.rendererParams);
    },
});


GanttController = GanttController.include({
    
   
    init: function (parent, model, renderer, params) {
        this._super.apply(this, arguments);
        this.model = model;
        this.context = params.context;
        this.dialogViews = params.dialogViews;
        this.SCALES = {
            day: { string: _t('Day'), cellPrecisions: { full: 60, half: 30, quarter: 15 }, defaultPrecision: 'full', time: 'minutes', interval: 'hour' },
            week: { string: _t('Week'), cellPrecisions: { full: 24, half: 12 }, defaultPrecision: 'half', time: 'hours', interval: 'day' },
            month: { string: _t('Month'), cellPrecisions: { full: 24, half: 12 }, defaultPrecision: 'half', time: 'hours', interval: 'day' },
            threemonth: { string: _t('3 Months'), cellPrecisions: { full: 24, half: 12 }, defaultPrecision: 'half', time: 'hours', interval: 'day' },
            year: { string: _t('Year'), cellPrecisions: { full: 1 }, defaultPrecision: 'full', time: 'months', interval: 'month' },
        };
        this.allowedScales = Object.keys(this.SCALES);
        this.collapseFirstLevel = params.collapseFirstLevel;
        this.createAction = params.createAction;

        this.isRTL = _t.database.parameters.direction === "rtl";
    },
    renderButtons: function ($node) {
        this.SCALES = {
              day: { string: _t('Day'), cellPrecisions: { full: 60, half: 30, quarter: 15 }, defaultPrecision: 'full', time: 'minutes', interval: 'hour' },
              week: { string: _t('Week'), cellPrecisions: { full: 24, half: 12 }, defaultPrecision: 'half', time: 'hours', interval: 'day' },
              month: { string: _t('Month'), cellPrecisions: { full: 24, half: 12 }, defaultPrecision: 'half', time: 'hours', interval: 'day' },
              threemonth: { string: _t('3 Months'), cellPrecisions: { full: 24, half: 12 }, defaultPrecision: 'half', time: 'hours', interval: 'day' },
              year: { string: _t('Year'), cellPrecisions: { full: 1 }, defaultPrecision: 'full', time: 'months', interval: 'month' },
          };
          if ($node) {
              var state = this.model.get();
              this.$buttons = $(QWeb.render('GanttView.buttons', {
                  groupedBy: state.groupedBy,
                  widget: this,
                  SCALES: this.SCALES,
                  activateScale: state.scale,
                  allowedScales: this.allowedScales,
              }));
              this.$buttons.appendTo($node);
          }
      },
      _getDialogContext: function (date, groupId) {
        this.SCALES = {
            day: { string: _t('Day'), cellPrecisions: { full: 60, half: 30, quarter: 15 }, defaultPrecision: 'full', time: 'minutes', interval: 'hour' },
            week: { string: _t('Week'), cellPrecisions: { full: 24, half: 12 }, defaultPrecision: 'half', time: 'hours', interval: 'day' },
            month: { string: _t('Month'), cellPrecisions: { full: 24, half: 12 }, defaultPrecision: 'half', time: 'hours', interval: 'day' },
            threemonth: { string: _t('3 Months'), cellPrecisions: { full: 24, half: 12 }, defaultPrecision: 'half', time: 'hours', interval: 'day' },
            year: { string: _t('Year'), cellPrecisions: { full: 1 }, defaultPrecision: 'full', time: 'months', interval: 'month' },
        };
          var state = this.model.get();
          var context = {};
          context[state.dateStartField] = date.clone();
          context[state.dateStopField] = date.clone().endOf(this.SCALES[state.scale].interval);
  
          if (groupId) {
              // Default values of the group this cell belongs in
              // We can read them from any pill in this group row
              _.each(state.groupedBy, function (fieldName) {
                  var groupValue = _.find(state.groups, function (group) {
                      return group.id === groupId;
                  });
                  var value = groupValue[fieldName];
                  // If many2one field then extract id from array
                  if (_.isArray(value)) {
                      value = value[0];
                  }
                  context[fieldName] = value;
              });
          }
  
          // moment context dates needs to be converted in server time in view
          // dialog (for default values)
          for (var k in context) {
              var type = state.fields[k].type;
              if (context[k] && (type === 'datetime' || type === 'date')) {
                  context[k] = this.model.convertToServerTime(context[k]);
              }
          }
  
          return context;
      },
      _onPillDropped: function (ev) {
          ev.stopPropagation();
          this.SCALES = {
            day: { string: _t('Day'), cellPrecisions: { full: 60, half: 30, quarter: 15 }, defaultPrecision: 'full', time: 'minutes', interval: 'hour' },
            week: { string: _t('Week'), cellPrecisions: { full: 24, half: 12 }, defaultPrecision: 'half', time: 'hours', interval: 'day' },
            month: { string: _t('Month'), cellPrecisions: { full: 24, half: 12 }, defaultPrecision: 'half', time: 'hours', interval: 'day' },
            threemonth: { string: _t('3 Months'), cellPrecisions: { full: 24, half: 12 }, defaultPrecision: 'half', time: 'hours', interval: 'day' },
            year: { string: _t('Year'), cellPrecisions: { full: 1 }, defaultPrecision: 'full', time: 'months', interval: 'month' },
        };
          var state = this.model.get();
  
          var schedule = {};
  
          var diff = ev.data.diff;
          diff = this.isRTL ? -diff : diff;
          if (diff) {
              var pill = _.findWhere(state.records, { id: ev.data.pillId });
              schedule[state.dateStartField] = this.model.dateAdd(pill[state.dateStartField], diff, this.SCALES[state.scale].time);
              schedule[state.dateStopField] = this.model.dateAdd(pill[state.dateStopField], diff, this.SCALES[state.scale].time);
          } else if (ev.data.action === 'copy') {
              // When we copy the info on dates is sometimes mandatory (e.g. working on hr.leave, see copy_data)
              const pill = _.findWhere(state.records, { id: ev.data.pillId });
              schedule[state.dateStartField] = pill[state.dateStartField].clone();
              schedule[state.dateStopField] = pill[state.dateStopField].clone();
          }
  
          if (ev.data.newGroupId && ev.data.newGroupId !== ev.data.oldGroupId) {
              var group = _.findWhere(state.groups, { id: ev.data.newGroupId });
  
              // if the pill is dragged in a top level group, we only want to
              // write on fields linked to this top level group
              var fieldsToWrite = state.groupedBy.slice(0, ev.data.groupLevel + 1);
              _.each(fieldsToWrite, function (fieldName) {
                  // TODO: maybe not write if the value hasn't changed?
                  schedule[fieldName] = group[fieldName];
  
                  // TODO: maybe check if field.type === 'many2one' instead
                  if (_.isArray(schedule[fieldName])) {
                      schedule[fieldName] = schedule[fieldName][0];
                  }
              });
          }
          if (ev.data.action === 'copy') {
              this._copy(ev.data.pillId, schedule);
          } else {
              this._reschedule(ev.data.pillId, schedule);
          }
      },
      _onNextPeriodClicked: function (ev) {
        ev.preventDefault();
        var state = this.model.get();
        this.update({ date: state.focusDate.add(1, (state.scale=='threemonth')?'month':state.scale) });
    },
    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onPrevPeriodClicked: function (ev) {
        ev.preventDefault();
        var state = this.model.get();
        this.update({ date: state.focusDate.subtract(1,  (state.scale=='threemonth')?'month':state.scale) });
    },
});
var _super_orderline = GanttRenderer.prototype;
GanttRenderer = GanttRenderer.include({
    init: function (parent, state, params) {
        var self = this;
        this._super.apply(this, arguments);

        this.$draggedPill = null;
        this.$draggedPillClone = null;

        this.canCreate = params.canCreate;
        this.canEdit = params.canEdit;
        this.canPlan = params.canPlan;
        this.cellPrecisions = params.cellPrecisions;
        this.colorField = params.colorField;
        this.progressField = params.progressField;
        this.consolidationParams = params.consolidationParams;
        this.fieldsInfo = params.fieldsInfo;
        this.SCALES = {
            day: { string: _t('Day'), cellPrecisions: { full: 60, half: 30, quarter: 15 }, defaultPrecision: 'full', time: 'minutes', interval: 'hour' },
            week: { string: _t('Week'), cellPrecisions: { full: 24, half: 12 }, defaultPrecision: 'half', time: 'hours', interval: 'day' },
            month: { string: _t('Month'), cellPrecisions: { full: 24, half: 12 }, defaultPrecision: 'half', time: 'hours', interval: 'day' },
            threemonth: { string: _t('3 Months'), cellPrecisions: { full: 24, half: 12 }, defaultPrecision: 'half', time: 'hours', interval: 'day' },
            year: { string: _t('Year'), cellPrecisions: { full: 1 }, defaultPrecision: 'full', time: 'months', interval: 'month' },
        };
        this.string = params.string;
        this.totalRow = params.totalRow;
        this.collapseFirstLevel = params.collapseFirstLevel;
        this.thumbnails = params.thumbnails;
        this.rowWidgets = {};
        // Pill decoration colors, By default display primary color for pill
        this.pillDecorations = _.chain(this.arch.attrs)
            .pick(function (value, key) {
                return self.DECORATIONS.indexOf(key) >= 0;
            }).mapObject(function (value) {
                return py.parse(py.tokenize(value));
            }).value();
        if (params.popoverTemplate) {
            this.popoverQWeb = new qweb(config.isDebug(), {_s: session.origin});
            this.popoverQWeb.add_template(utils.json_node_to_xml(params.popoverTemplate));
        } else {
            this.popoverQWeb = QWeb;
        }

        this.isRTL = _t.database.parameters.direction === "rtl";
    },
    _prepareViewInfo: function () {
       
        //alert('I am peraper')
        var state={ ...this.state};
        state.scale=(this.state.scale=='threemonth')?'week':this.state.scale;
        console.log('this.viewInfo',state.scale)
        console.log('this.viewInfo2',this.state.scale)
        return {
            colorField: this.colorField,
            progressField: this.progressField,
            consolidationParams: this.consolidationParams,
            state: state,
            fieldsInfo: this.fieldsInfo,
            slots: this._getSlotsDates(),
            pillDecorations: this.pillDecorations,
            popoverQWeb: this.popoverQWeb,
            activeScaleInfo: {
                precision: this.cellPrecisions[(this.state.scale=='threemonth')?'month':this.state.scale],
                interval: this.SCALES[this.state.scale].cellPrecisions[this.cellPrecisions[(this.state.scale=='threemonth')?'month':this.state.scale]],
                time: this.SCALES[this.state.scale].time,
            },
        };
    },
    _getFocusDateFormat: function () {
        this.SCALES = {
            day: { string: _t('Day'), cellPrecisions: { full: 60, half: 30, quarter: 15 }, defaultPrecision: 'full', time: 'minutes', interval: 'hour' },
            week: { string: _t('Week'), cellPrecisions: { full: 24, half: 12 }, defaultPrecision: 'half', time: 'hours', interval: 'day' },
            month: { string: _t('Month'), cellPrecisions: { full: 24, half: 12 }, defaultPrecision: 'half', time: 'hours', interval: 'day' },
            threemonth: { string: _t('3 Months'), cellPrecisions: { full: 24, half: 12 }, defaultPrecision: 'half', time: 'hours', interval: 'day' },
            year: { string: _t('Year'), cellPrecisions: { full: 1 }, defaultPrecision: 'full', time: 'months', interval: 'month' },
        };
        var focusDate = this.state.focusDate;
        console.log('this.state.scale',this.state.scale);
        
        self.$('.o_gantt_view').css('width','auto');
        switch (this.state.scale) {
            case 'day':
                return focusDate.format('DD MMMM YYYY');
                case 'week':
                    var dateStart = focusDate.clone().startOf('week').format('DD MMMM YYYY');
                    var dateEnd = focusDate.clone().endOf('week').format('DD MMMM YYYY');
                    return _.str.sprintf('%s - %s', dateStart, dateEnd);
                case 'threemonth':
                    $('.o_gantt_view').css('width','3000px');
                    var dateStart = focusDate.clone().startOf('month').format('DD MMMM YYYY');
                    var dateEnd = focusDate.clone().add(2,'month').endOf('month').format('DD MMMM YYYY');
                    return _.str.sprintf('%s - %s', dateStart, dateEnd);
            case 'month':
                return focusDate.format('MMMM YYYY');
            case 'year':
                return focusDate.format('YYYY');
            default:
                break;
        }
    },
   
});

GanttModel.include({
    load: function (params) {
        console.log('param',params);
        this.modelName = params.modelName;
        this.fields = params.fields;
        this.domain = params.domain;
        this.context = params.context;
        this.decorationFields = params.decorationFields;
        this.colorField = params.colorField;
        this.progressField = params.progressField;
        this.consolidationParams = params.consolidationParams;
        this.collapseFirstLevel = params.collapseFirstLevel;
        this.displayUnavailability = params.displayUnavailability;

        this.defaultGroupBy = params.defaultGroupBy ? [params.defaultGroupBy] : [];
        if (!params.groupedBy || !params.groupedBy.length) {
            params.groupedBy = this.defaultGroupBy;
        }

        this.ganttData = {
            dateStartField: params.dateStartField,
            dateStopField: params.dateStopField,
            groupedBy: params.groupedBy,
            fields: params.fields,
        };
        this._setRange(params.initialDate, params.scale);
        return this._fetchData().then(function () {
            // The 'load' function returns a promise which resolves with the
            // handle to pass to the 'get' function to access the data. In this
            // case, we don't want to pass any argument to 'get' (see its API).
            return Promise.resolve();
        });
    },
    _setRange: function (focusDate, scale) {
        console.log('focusDate',focusDate);
        console.log('scale',scale);
        switch (scale) {
            case 'threemonth':
                
                break;
        
            default:

                break;
        }
        this.ganttData.scale = scale;
        this.ganttData.focusDate = focusDate;
        this.ganttData.startDate = (scale=='threemonth')?focusDate.clone().startOf('month'):focusDate.clone().startOf(scale);
    
        this.ganttData.stopDate = (scale=='threemonth')?focusDate.clone().add(2,'month').endOf('month'):focusDate.clone().endOf(scale);
    },
    _fetchUnavailability: function () {
        var self = this;
        return this._rpc({
            model: this.modelName,
            method: 'gantt_unavailability',
            args: [
                this.convertToServerTime(this.ganttData.startDate),
                this.convertToServerTime(this.ganttData.stopDate),
                (this.ganttData.scale=='threemonth')?'month':this.ganttData.scale,
                this.ganttData.groupedBy,
                this._computeUnavailabilityRows(this.ganttData.rows),
            ],
            context: this.context,
        }).then(function (enrichedRows) {
            // Update ganttData.rows with the new unavailabilities data
            self._updateUnavailabilityRows(self.ganttData.rows, enrichedRows);
        });
    },
})
var _super_orderline = GanttRow.prototype;
 GanttRow.include({
    init: function (parent, pillsInfo, viewInfo, options) {
        this._super.apply(this, arguments);
        var self = this;
        console.log('pillsInfo',pillsInfo);
        this.name = pillsInfo.groupName;
        this.groupId = pillsInfo.groupId;
        this.groupLevel = pillsInfo.groupLevel;
        this.groupedByField = pillsInfo.groupedByField;
        this.pills = _.map(pillsInfo.pills, _.clone);
        this.resId = pillsInfo.resId;

        this.viewInfo = viewInfo;
        this.fieldsInfo = viewInfo.fieldsInfo;
        this.state = viewInfo.state;
        this.colorField = viewInfo.colorField;

        this.options = options;
        this.SCALES = {
            day: { string: _t('Day'), cellPrecisions: { full: 60, half: 30, quarter: 15 }, defaultPrecision: 'full', time: 'minutes', interval: 'hour' },
            week: { string: _t('Week'), cellPrecisions: { full: 24, half: 12 }, defaultPrecision: 'half', time: 'hours', interval: 'day' },
            month: { string: _t('Month'), cellPrecisions: { full: 24, half: 12 }, defaultPrecision: 'half', time: 'hours', interval: 'day' },
            threemonth: { string: _t('3 Months'), cellPrecisions: { full: 24, half: 12 }, defaultPrecision: 'half', time: 'hours', interval: 'day' },
            year: { string: _t('Year'), cellPrecisions: { full: 1 }, defaultPrecision: 'full', time: 'months', interval: 'month' },
        };
        this.isGroup = options.isGroup;
        this.isOpen = options.isOpen;
        this.rowId = options.rowId;
        this.unavailabilities = _.map(options.unavailabilities, function(u) {
            u.startDate = self._convertToUserTime(u.start);
            u.stopDate = self._convertToUserTime(u.stop);
            return u;
        });
        this._snapToGrid(this.unavailabilities);

        this.consolidate = options.consolidate;
        this.consolidationParams = viewInfo.consolidationParams;

        if(options.thumbnail){
            this.thumbnailUrl = session.url('/web/image', {
                model: options.thumbnail.model,
                id: this.resId,
                field: this.options.thumbnail.field,
            });
        }

        // the total row has some special behaviour
        this.isTotal = this.groupId === 'groupTotal';

        this._adaptPills();
        this._snapToGrid(this.pills);
        this._calculateLevel();
        if (this.isGroup && this.pills.length) {
            this._aggregateGroupedPills();
        } else {
            this.progressField = viewInfo.progressField;
            this._evaluateDecoration();
        }
        this._calculateMarginAndWidth();
        this._insertIntoSlot();

        // Add the 16px odoo window default padding.
        this.leftPadding = (this.groupLevel + 1) * this.LEVEL_LEFT_OFFSET;
        this.cellHeight = this.level * this.LEVEL_TOP_OFFSET + (this.level > 0 ? this.level - 1 : 0);

        this.MIN_WIDTHS = { full: 100, half: 50, quarter: 25 };
        this.PARTS = { full: 1, half: 2, quarter: 4 };

        this.cellMinWidth = this.MIN_WIDTHS[this.viewInfo.activeScaleInfo.precision];
        this.cellPart = this.PARTS[this.viewInfo.activeScaleInfo.precision];

        this.childrenRows = [];

        this._onButtonAddClicked = _.debounce(this._onButtonAddClicked, 500, true);
        this._onButtonPlanClicked = _.debounce(this._onButtonPlanClicked, 500, true);
        this._onPillClicked = _.debounce(this._onPillClicked, 500, true);

        if (this.isTotal) {
            const maxCount = Math.max(...this.pills.map(p => p.count));
            const factor = maxCount ? (90 / maxCount) : 0;
            for (let p of this.pills) {
                p.totalHeight = factor * p.count;
            }
        }
        this.isRTL = _t.database.parameters.direction === "rtl";
    },
    /**
     * Calculate left margin and width for pills
     *
     * @private
     */
    _calculateMarginAndWidth: function () {
        this.SCALES = {
            day: { string: _t('Day'), cellPrecisions: { full: 60, half: 30, quarter: 15 }, defaultPrecision: 'full', time: 'minutes', interval: 'hour' },
            week: { string: _t('Week'), cellPrecisions: { full: 24, half: 12 }, defaultPrecision: 'half', time: 'hours', interval: 'day' },
            month: { string: _t('Month'), cellPrecisions: { full: 24, half: 12 }, defaultPrecision: 'half', time: 'hours', interval: 'day' },
            threemonth: { string: _t('3 Months'), cellPrecisions: { full: 24, half: 12 }, defaultPrecision: 'half', time: 'hours', interval: 'day' },
            year: { string: _t('Year'), cellPrecisions: { full: 1 }, defaultPrecision: 'full', time: 'months', interval: 'month' },
        };
        var self = this;
        var left;
        var diff;
        this.pills.forEach(function (pill) {
            switch (self.state.scale) {
                case 'day':
                    left = pill.startDate.diff(pill.startDate.clone().startOf('hour'), 'minutes');
                    pill.leftMargin = (left / 60) * 100;
                    diff = pill.stopDate.diff(pill.startDate, 'minutes');
                    var gapSize = pill.stopDate.diff(pill.startDate, 'hours') - 1; // Eventually compensate border(s) width
                    pill.width = gapSize > 0 ? 'calc(' + (diff / 60) * 100 + '% + ' + gapSize + 'px)' : (diff / 60) * 100 + '%';
                    break;
                case 'week':
                case 'month':
                case 'threemonth':
                        left = pill.startDate.diff(pill.startDate.clone().startOf('day'), 'hours');
                        pill.leftMargin = (left / 24) * 100;
                        diff = pill.stopDate.diff(pill.startDate, 'hours');
                        console.log('dif',diff)
                        var gapSize = pill.stopDate.diff(pill.startDate, 'days') - 1; // Eventually compensate border(s) width
                        pill.width = gapSize > 0 ? 'calc(' + (diff / 24) * 100 + '% + ' + gapSize + 'px)' : (diff / 24) * 100 + '%';
                        break;
                    
                   
                case 'year':
                    var startDateMonthStart = pill.startDate.clone().startOf('month');
                    var stopDateMonthEnd = pill.stopDate.clone().endOf('month');
                    left = pill.startDate.diff(startDateMonthStart, 'days');
                    pill.leftMargin = (left / 30) * 100;

                    var monthsDiff = stopDateMonthEnd.diff(startDateMonthStart, 'months', true);
                    if (monthsDiff < 1) {
                        // A 30th of a month slot is too small to display
                        // 1-day events are displayed as if they were 2-days events
                        diff = Math.max(Math.ceil(pill.stopDate.diff(pill.startDate, 'days', true)), 2);
                        pill.width = (diff / pill.startDate.daysInMonth()) * 100 + "%";
                    } else {
                        // The pill spans more than one month, so counting its
                        // number of days is not enough as some months have more
                        // days than others. We need to compute the proportion
                        // of each month that the pill is actually taking.
                        var startDateMonthEnd = pill.startDate.clone().endOf('month');
                        var diffMonthStart = Math.ceil(startDateMonthEnd.diff(pill.startDate, 'days', true));
                        var widthMonthStart = (diffMonthStart / pill.startDate.daysInMonth());

                        var stopDateMonthStart = pill.stopDate.clone().startOf('month');
                        var diffMonthStop = Math.ceil(pill.stopDate.diff(stopDateMonthStart, 'days', true));
                        var widthMonthStop = (diffMonthStop / pill.stopDate.daysInMonth());

                        var width = Math.max((widthMonthStart + widthMonthStop), (2 / 30)) * 100;
                        if (monthsDiff > 2) { // start and end months are already covered
                            // If the pill spans more than 2 months, we know
                            // that the middle months are fully covered
                            width += (monthsDiff - 2) * 100;
                        }
                        pill.width = width + "%";
                    }
                    break;
                default:
                    break;
            }

            // Add 1px top-gap to events sharing the same cell.
            pill.topPadding = pill.level * (self.LEVEL_TOP_OFFSET + 1);
        });
    },
    _snapToGrid: function (timeSpans) {
        var self = this;
        var interval = this.viewInfo.activeScaleInfo.interval;
        switch (this.state.scale) {
            case 'day':
                timeSpans.forEach(function (span) {
                    var snappedStartDate = self._snapMinutes(span.startDate, interval);
                    var snappedStopDate = self._snapMinutes(span.stopDate, interval);
                    // Set min width
                    var minuteDiff = snappedStartDate.diff(snappedStopDate, 'minute');
                    if (minuteDiff === 0) {
                        if (snappedStartDate > span.startDate) {
                            span.startDate = snappedStartDate.subtract(interval, 'minute');
                            span.stopDate = snappedStopDate;
                        } else {
                            span.startDate = snappedStartDate;
                            span.stopDate = snappedStopDate.add(interval, 'minute');
                        }
                    } else {
                        span.startDate = snappedStartDate;
                        span.stopDate = snappedStopDate;
                    }
                });
                break;
            case 'week':
            case 'month':
            case 'threemonth':
                timeSpans.forEach(function (span) {
                    var snappedStartDate = self._snapHours(span.startDate, interval);
                    var snappedStopDate = self._snapHours(span.stopDate, interval);
                    // Set min width_snapToGrid
                    var hourDiff = snappedStartDate.diff(snappedStopDate, 'hour');
                    if (hourDiff === 0) {
                        if (snappedStartDate > span.startDate) {
                            span.startDate = snappedStartDate.subtract(interval, 'hour');
                            span.stopDate = snappedStopDate;
                        } else {
                            span.startDate = snappedStartDate;
                            span.stopDate = snappedStopDate.add(interval, 'hour');
                        }
                    } else {
                        span.startDate = snappedStartDate;
                        span.stopDate = snappedStopDate;
                    }
                });
                break;
            case 'year':
                timeSpans.forEach(function (span) {
                    span.startDate = span.startDate.clone().startOf('month');
                    span.stopDate = span.stopDate.clone().endOf('month');
                });
                break;
            default:
                break;
        }
    },
}); 









})