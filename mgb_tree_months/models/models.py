# -*- coding: utf-8 -*-

# from odoo import models, fields, api


# class mgb_tree_months(models.Model):
#     _name = 'mgb_tree_months.mgb_tree_months'
#     _description = 'mgb_tree_months.mgb_tree_months'

#     name = fields.Char()
#     value = fields.Integer()
#     value2 = fields.Float(compute="_value_pc", store=True)
#     description = fields.Text()
#
#     @api.depends('value')
#     def _value_pc(self):
#         for record in self:
#             record.value2 = float(record.value) / 100
