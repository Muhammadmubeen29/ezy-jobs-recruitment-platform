const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  action: {
    type: String,
    required: true,
  },
  actorId: {
    type: String,
  },
  actorType: {
    type: String,
    enum: ['internal-service', 'user', 'system'],
    default: 'internal-service',
  },
  route: {
    type: String,
  },
  method: {
    type: String,
  },
  ip: {
    type: String,
  },
  userAgent: {
    type: String,
  },
  details: {
    type: mongoose.Schema.Types.Mixed,
  },
}, {
  timestamps: true,
});

auditLogSchema.index({ action: 1, actorId: 1 });

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

module.exports = AuditLog;
