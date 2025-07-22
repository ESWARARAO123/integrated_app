/**
 * Migration: Add missing columns to messages table for SQLite compatibility
 * This fixes the issue where the messages table was missing columns expected by the chatbot code
 */

exports.up = function(knex) {
  return knex.schema.table('messages', function(table) {
    // Add columns if they don't exist
    table.text('user_id').nullable();
    table.text('message').nullable();
    table.text('response').nullable();
    table.datetime('timestamp').defaultTo(knex.fn.now());
    table.text('file_path').nullable();
    table.text('document_id').nullable();
    table.boolean('is_context_update').defaultTo(false);
    table.text('predictor_data').nullable(); // Add predictor_data column
  });
};

exports.down = function(knex) {
  return knex.schema.table('messages', function(table) {
    table.dropColumn('user_id');
    table.dropColumn('message');
    table.dropColumn('response');
    table.dropColumn('timestamp');
    table.dropColumn('file_path');
    table.dropColumn('document_id');
    table.dropColumn('is_context_update');
    table.dropColumn('predictor_data'); // Drop predictor_data column
  });
};