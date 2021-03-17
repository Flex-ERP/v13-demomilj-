# -*- coding: utf-8 -*-
# from odoo import http


# class MgbTreeMonths(http.Controller):
#     @http.route('/mgb_tree_months/mgb_tree_months/', auth='public')
#     def index(self, **kw):
#         return "Hello, world"

#     @http.route('/mgb_tree_months/mgb_tree_months/objects/', auth='public')
#     def list(self, **kw):
#         return http.request.render('mgb_tree_months.listing', {
#             'root': '/mgb_tree_months/mgb_tree_months',
#             'objects': http.request.env['mgb_tree_months.mgb_tree_months'].search([]),
#         })

#     @http.route('/mgb_tree_months/mgb_tree_months/objects/<model("mgb_tree_months.mgb_tree_months"):obj>/', auth='public')
#     def object(self, obj, **kw):
#         return http.request.render('mgb_tree_months.object', {
#             'object': obj
#         })
