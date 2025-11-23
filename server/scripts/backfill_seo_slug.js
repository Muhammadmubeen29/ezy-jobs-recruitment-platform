#!/usr/bin/env node
require('dotenv').config();

const connectDB = require('../config/database');
const { Job } = require('../models');

const slugify = (text) =>
  String(text || 'job')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const main = async () => {
  await connectDB();

  const argv = process.argv.slice(2);
  const fixIndex = argv.includes('--fix-index');

  console.log('Searching for jobs missing seo.slug...');

  const query = {
    $or: [
      { 'seo.slug': { $exists: false } },
      { 'seo.slug': null },
      { 'seo.slug': '' },
    ],
  };

  const jobs = await Job.find(query).lean();
  console.log(`Found ${jobs.length} job(s) needing seo.slug backfill`);

  for (const job of jobs) {
    const base = job.title || 'job';
    const candidate = slugify(base);
    let unique = candidate;
    let attempt = 0;

    // Ensure uniqueness
    while (true) {
      // eslint-disable-next-line no-await-in-loop
      const exists = await Job.findOne({ 'seo.slug': unique }).lean();
      if (!exists) break;
      attempt += 1;
      unique = `${candidate}-${Date.now().toString().slice(-5)}-${Math.floor(Math.random() * 10000)}`;
      if (attempt > 20) {
        unique = `${candidate}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
        break;
      }
    }

    // Update document
    // eslint-disable-next-line no-await-in-loop
    await Job.updateOne({ _id: job._id }, { $set: { 'seo.slug': unique } });
    console.log(`Backfilled job ${job._id} -> seo.slug='${unique}'`);
  }

  if (fixIndex) {
    console.log('Recreating unique partial index on seo.slug...');
    const col = Job.collection;
    try {
      // Try to drop the specific index name if it exists
      // index name often is 'seo.slug_1'
      // If it doesn't exist, dropIndex will throw which we catch and continue
      // eslint-disable-next-line no-await-in-loop
      await col.dropIndex('seo.slug_1');
      console.log('Dropped existing index seo.slug_1');
    } catch (err) {
      console.log('No existing seo.slug_1 index found or drop failed:', err.message);
    }

    // Create a partial unique index so documents without seo.slug are allowed
    // and only documents with a string seo.slug will be enforced unique
    // eslint-disable-next-line no-await-in-loop
    await col.createIndex({ 'seo.slug': 1 }, { unique: true, partialFilterExpression: { 'seo.slug': { $type: 'string' } } });
    console.log('Created partial unique index on seo.slug');
  }

  // Also ensure application unique index uses current field names (jobId, candidateId)
  try {
    const appCol = (await require('../models/application')).collection;
    try {
      await appCol.dropIndex('job_1_candidate_1');
      console.log('Dropped old applications index job_1_candidate_1');
    } catch (err) {
      console.log('No old applications index found or drop failed:', err.message);
    }

    await appCol.createIndex({ jobId: 1, candidateId: 1 }, { unique: true, partialFilterExpression: { jobId: { $type: 'objectId' }, candidateId: { $type: 'objectId' } } });
    console.log('Created partial unique index on applications (jobId, candidateId)');
  } catch (err) {
    console.log('Failed to ensure applications index:', err.message);
  }

  console.log('Backfill completed.');
  process.exit(0);
};

main().catch((err) => {
  console.error('Backfill script failed:', err);
  process.exit(1);
});
