require('dotenv').config();
const connectDB = require('../config/database');

const run = async () => {
  try {
    await connectDB();

    const { Application } = require('../models');

    const jobId = process.argv[2];
    if (!jobId) {
      console.error('Usage: node check_and_revert_rejected.js <JOB_ID>');
      process.exit(1);
    }

    const apps = await Application.find({ jobId }).populate('candidateId', 'firstName lastName email');

    console.log(`Found ${apps.length} applications for job ${jobId}`);

    apps.forEach((a) => {
      console.log(`- ${a._id.toString()} : status=${a.status} candidate=${a.candidateId?.firstName || 'n/a'} ${a.candidateId?.lastName || ''}`);
    });

    const rejected = apps.filter((a) => a.status === 'rejected');

    if (rejected.length === 0) {
      console.log('No rejected applications to revert.');
      process.exit(0);
    }

    const ids = rejected.map((r) => r._id);

    const res = await Application.updateMany({ _id: { $in: ids } }, { $set: { status: 'applied' } });

    console.log(`Reverted ${res.modifiedCount || res.nModified || 0} rejected application(s) to 'applied'.`);
    process.exit(0);
  } catch (err) {
    console.error('Script error:', err && err.message);
    process.exit(1);
  }
};

run();
