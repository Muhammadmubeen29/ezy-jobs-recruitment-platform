require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/database');

async function run() {
  const jobId = process.argv[2];
  if (!jobId) {
    console.error('Usage: node scripts/debug_shortlist.js <JOB_ID>');
    process.exit(2);
  }

  await connectDB();

  // Load models
  const { Application, Resume, User, Job } = require('../models');

  try {
    const job = await Job.findById(jobId).lean();
    console.log('Job:', job ? { id: job._id.toString(), title: job.title } : null);

    const applications = await Application.find({ jobId, status: 'applied' })
      .populate({ path: 'candidateId', select: 'firstName lastName email' })
      .lean();

    console.log(`Found ${applications.length} application(s) with status 'applied' for job ${jobId}`);

    for (const app of applications) {
      console.log('--- Application ---');
      console.log('id:', app._id.toString());
      console.log('candidateId:', app.candidateId ? app.candidateId._id.toString() : app.candidateId);
      console.log('candidate:', app.candidateId ? `${app.candidateId.firstName} ${app.candidateId.lastName} <${app.candidateId.email}>` : null);

      const resume = await Resume.findOne({ userId: app.candidateId?._id || app.candidateId }).lean();
      console.log('resume found:', !!resume);
      if (resume) {
        console.log('resume id:', resume._id.toString());
        console.log('resume summary length:', resume.summary ? resume.summary.length : 0);
        console.log('resume skills:', resume.skills || []);
      }
    }

    if (applications.length === 0) {
      console.log('No applications returned for this job.');
    }

    process.exit(0);
  } catch (err) {
    console.error('Error while debugging shortlist:', err);
    process.exit(1);
  }
}

run();
