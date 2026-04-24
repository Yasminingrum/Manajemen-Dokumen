const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

const { documents, addLog } = require('../data/store');
const { authenticate } = require('../middleware/auth');
const {
  canReadDocument,
  canDeleteDocument,
  canUpdateDocument,
  canCreateDocument,
} = require('../utils/policy');

// ============================================================
// GET /api/documents — List documents user can read
// ============================================================
router.get('/', authenticate, (req, res) => {
  const user = req.user;
  const accessible = [];
  const denied = [];

  for (const doc of documents) {
    const { allowed, reason } = canReadDocument(user, doc);
    if (allowed) {
      accessible.push(doc);
    } else {
      denied.push({ id: doc.id, title: doc.title, reason });
    }
  }

  addLog(user.id, user.username, 'LIST_DOCUMENTS', 'DOCUMENTS', 'ALLOWED',
    `Can see ${accessible.length}/${documents.length} documents`);

  res.json({
    accessible,
    denied,
    stats: { total: documents.length, accessible: accessible.length, denied: denied.length },
  });
});

// ============================================================
// GET /api/documents/:id — Read single document
// ============================================================
router.get('/:id', authenticate, (req, res) => {
  const user = req.user;
  const doc = documents.find(d => d.id === req.params.id);

  if (!doc) {
    return res.status(404).json({ error: 'Document not found' });
  }

  const { allowed, reason } = canReadDocument(user, doc);

  addLog(user.id, user.username, 'READ_DOCUMENT', `DOC:${doc.id}(${doc.title})`,
    allowed ? 'ALLOWED' : 'DENIED', reason);

  if (!allowed) {
    return res.status(403).json({
      error: 'Access denied',
      reason,
      policy: 'RBAC+ABAC: requires sufficient clearance and department match',
    });
  }

  res.json({ document: doc, accessReason: reason });
});

// ============================================================
// POST /api/documents — Create document
// RBAC: ADMIN, MANAGER, STAFF (not VIEWER)
// ============================================================
router.post('/', authenticate, (req, res) => {
  const user = req.user;
  const { title, content, classification } = req.body;

  const { allowed, reason } = canCreateDocument(user);
  addLog(user.id, user.username, 'CREATE_DOCUMENT', 'DOCUMENTS', allowed ? 'ALLOWED' : 'DENIED', reason);

  if (!allowed) {
    return res.status(403).json({ error: 'Access denied', reason });
  }

  if (!title || !content) {
    return res.status(400).json({ error: 'Title and content are required' });
  }

  const newDoc = {
    id: `d${String(documents.length + 1).padStart(3, '0')}_${uuidv4().slice(0, 4)}`,
    title,
    content,
    department: user.department,
    classification: classification || 'CONFIDENTIAL',
    ownerId: user.id,
    ownerName: user.username,
    createdAt: new Date().toISOString().split('T')[0],
    updatedAt: new Date().toISOString().split('T')[0],
  };

  documents.push(newDoc);
  res.status(201).json({ document: newDoc, message: 'Document created', accessReason: reason });
});

// ============================================================
// PUT /api/documents/:id — Update document
// RBAC+ABAC: same department + sufficient clearance
// ============================================================
router.put('/:id', authenticate, (req, res) => {
  const user = req.user;
  const doc = documents.find(d => d.id === req.params.id);

  if (!doc) return res.status(404).json({ error: 'Document not found' });

  const { allowed, reason } = canUpdateDocument(user, doc);
  addLog(user.id, user.username, 'UPDATE_DOCUMENT', `DOC:${doc.id}`, allowed ? 'ALLOWED' : 'DENIED', reason);

  if (!allowed) {
    return res.status(403).json({
      error: 'Access denied',
      reason,
      policy: 'RBAC+ABAC: requires same department and sufficient clearance level',
    });
  }

  const { title, content } = req.body;
  if (title) doc.title = title;
  if (content) doc.content = content;
  doc.updatedAt = new Date().toISOString().split('T')[0];

  res.json({ document: doc, message: 'Document updated', accessReason: reason });
});

// ============================================================
// DELETE /api/documents/:id — Delete document
// RBAC+ABAC:
//   ADMIN: can delete any department's document
//   MANAGER: can only delete documents from SAME department
//   STAFF/VIEWER: cannot delete
// ============================================================
router.delete('/:id', authenticate, (req, res) => {
  const user = req.user;
  const docIndex = documents.findIndex(d => d.id === req.params.id);

  if (docIndex === -1) return res.status(404).json({ error: 'Document not found' });

  const doc = documents[docIndex];
  const { allowed, reason } = canDeleteDocument(user, doc);

  addLog(user.id, user.username, 'DELETE_DOCUMENT', `DOC:${doc.id}(${doc.title})`,
    allowed ? 'ALLOWED' : 'DENIED', reason);

  if (!allowed) {
    return res.status(403).json({
      error: 'Access denied',
      reason,
      policy: 'RBAC+ABAC: ADMIN can delete any; MANAGER only same department; STAFF/VIEWER cannot delete',
    });
  }

  documents.splice(docIndex, 1);
  res.json({ message: `Document "${doc.title}" deleted successfully`, accessReason: reason });
});

module.exports = router;
