'use strict';

const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const User = require('../models/user');
const Resume = require('../models/resume');
const Job = require('../models/job');
const Application = require('../models/application');
const ChatRoom = require('../models/chatroom');
const Message = require('../models/message');
const Contract = require('../models/contract');
const Interview = require('../models/interview');
const InterviewerRating = require('../models/interviewerrating');
const Transaction = require('../models/transaction');

const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || process.env.DATABASE_URL;
    
    if (!mongoURI) {
      throw new Error('MongoDB URI not found in environment variables');
    }

    await mongoose.connect(mongoURI);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

const seedUsers = async () => {
  try {
    // Clear existing users
    await User.deleteMany({});
    console.log('🗑️  Cleared existing users');

    const users = [
      {
        firstName: 'Muhammad',
        lastName: 'Saad',
        email: 'admin@ezyjobs.com',
        phone: '+923229396560',
        password: await bcrypt.hash('Admin@123', 10),
        isVerified: true,
        isLinkedinVerified: false,
        isAdmin: true,
        isRecruiter: false,
        isInterviewer: false,
        isCandidate: false,
        isTopRated: false,
        stripeAccountId: null,
        stripeCustomerId: null,
        stripeAccountStatus: null,
        payoutEnabled: false,
      },
      {
        firstName: 'Moiz',
        lastName: 'Nadeem',
        email: 'recruiter@ezyjobs.com',
        phone: '+923002222222',
        password: await bcrypt.hash('Recruiter@123', 10),
        isVerified: true,
        isLinkedinVerified: true,
        isAdmin: false,
        isRecruiter: true,
        isInterviewer: false,
        isCandidate: false,
        isTopRated: true,
        stripeAccountId: null,
        stripeCustomerId: 'cus_recruiter123',
        stripeAccountStatus: null,
        payoutEnabled: false,
      },
      {
        firstName: 'Ahmed',
        lastName: 'Khan',
        email: 'interviewer@ezyjobs.com',
        phone: '+923003333333',
        password: await bcrypt.hash('Interviewer@123', 10),
        isVerified: true,
        isLinkedinVerified: true,
        isAdmin: false,
        isRecruiter: false,
        isInterviewer: true,
        isCandidate: false,
        isTopRated: true,
        stripeAccountId: 'acct_interviewer123',
        stripeCustomerId: null,
        stripeAccountStatus: 'verified',
        payoutEnabled: true,
      },
      {
        firstName: 'Sara',
        lastName: 'Ahmed',
        email: 'candidate@ezyjobs.com',
        phone: '+923004444444',
        password: await bcrypt.hash('Candidate@123', 10),
        isVerified: true,
        isLinkedinVerified: false,
        isAdmin: false,
        isRecruiter: false,
        isInterviewer: false,
        isCandidate: true,
        isTopRated: false,
        stripeAccountId: null,
        stripeCustomerId: null,
        stripeAccountStatus: null,
        payoutEnabled: false,
      },
    ];

    const createdUsers = await User.insertMany(users);
    console.log(`✅ Created ${createdUsers.length} users`);
    return createdUsers;
  } catch (error) {
    console.error('❌ Error seeding users:', error);
    throw error;
  }
};

const seedResumes = async (users) => {
  try {
    // Clear existing resumes
    await Resume.deleteMany({});
    console.log('🗑️  Cleared existing resumes');

    const candidate = users.find(user => user.isCandidate);
    
    if (candidate) {
      const resume = {
        title: 'Full Stack Developer',
        summary: 'Experienced full-stack developer with 3+ years of experience in React, Node.js, and MongoDB. Passionate about creating scalable web applications and solving complex problems.',
        headline: 'Full Stack Developer | React | Node.js | MongoDB',
        skills: ['JavaScript', 'React', 'Node.js', 'MongoDB', 'Express.js', 'HTML', 'CSS', 'Git'],
        experience: '3+ years of experience in full-stack development. Worked on various projects including e-commerce platforms, social media applications, and enterprise solutions.',
        education: 'Bachelor of Science in Computer Science from University of Technology',
        industry: 'Information Technology',
        availability: 'Two weeks',
        company: 'Tech Solutions Inc.',
        achievements: 'Led development of a high-traffic e-commerce platform serving 100k+ users. Implemented microservices architecture resulting in 40% performance improvement.',
        portfolio: 'https://saraahmed.dev',
        userId: candidate._id,
      };

      await Resume.create(resume);
      console.log('✅ Created resume for candidate');
    }
  } catch (error) {
    console.error('❌ Error seeding resumes:', error);
    throw error;
  }
};

const seedJobs = async (users) => {
  try {
    // Clear existing jobs
    await Job.deleteMany({});
    console.log('🗑️  Cleared existing jobs');

    const recruiter = users.find(user => user.isRecruiter);
    
    if (recruiter) {
      const jobs = [
        {
          title: 'Senior Full Stack Developer',
          description: 'We are looking for a Senior Full Stack Developer to join our dynamic team. You will be responsible for developing and maintaining web applications using modern technologies.',
          company: 'TechCorp Solutions',
          requirements: '5+ years of experience in full-stack development, proficiency in React, Node.js, and MongoDB, experience with cloud platforms, strong problem-solving skills.',
          benefits: 'Competitive salary, health insurance, flexible working hours, professional development opportunities, team building activities.',
          salaryRange: '$80k - $120k',
          category: 'IT',
          location: 'New York, NY',
          recruiterId: recruiter._id,
          isClosed: false,
        },
        {
          title: 'Frontend Developer',
          description: 'Join our frontend team to create amazing user experiences. We are looking for a creative and skilled frontend developer.',
          company: 'Design Studio',
          requirements: '3+ years of frontend development experience, expertise in React, TypeScript, and modern CSS frameworks, experience with responsive design.',
          benefits: 'Remote work options, creative environment, latest tools and technologies, mentorship program.',
          salaryRange: '$60k - $90k',
          category: 'IT',
          location: 'San Francisco, CA',
          recruiterId: recruiter._id,
          isClosed: false,
        },
      ];

      const createdJobs = await Job.insertMany(jobs);
      console.log(`✅ Created ${createdJobs.length} jobs`);
      return createdJobs;
    }
  } catch (error) {
    console.error('❌ Error seeding jobs:', error);
    throw error;
  }
};

const seedApplications = async (users, jobs) => {
  try {
    // Clear existing applications
    await Application.deleteMany({});
    console.log('🗑️  Cleared existing applications');

    const candidate = users.find(user => user.isCandidate);
    
    if (candidate && jobs.length > 0) {
      const applications = [
        {
          status: 'applied',
          applicationDate: new Date(),
          jobId: jobs[0]._id,
          candidateId: candidate._id,
        },
        {
          status: 'shortlisted',
          applicationDate: new Date(),
          jobId: jobs[1]._id,
          candidateId: candidate._id,
        },
      ];

      const createdApplications = await Application.insertMany(applications);
      console.log(`✅ Created ${createdApplications.length} applications`);
      return createdApplications;
    }
  } catch (error) {
    console.error('❌ Error seeding applications:', error);
    throw error;
  }
};

const seedChatRooms = async (users, jobs) => {
  try {
    // Clear existing chat rooms
    await ChatRoom.deleteMany({});
    console.log('🗑️  Cleared existing chat rooms');

    const recruiter = users.find(user => user.isRecruiter);
    const interviewer = users.find(user => user.isInterviewer);
    
    if (recruiter && interviewer && jobs.length > 0) {
      const chatRoom = {
        recruiterId: recruiter._id,
        interviewerId: interviewer._id,
        jobId: jobs[0]._id,
      };

      const createdChatRoom = await ChatRoom.create(chatRoom);
      console.log('✅ Created chat room');
      return createdChatRoom;
    }
  } catch (error) {
    console.error('❌ Error seeding chat rooms:', error);
    throw error;
  }
};

const seedMessages = async (chatRoom, users) => {
  try {
    // Clear existing messages
    await Message.deleteMany({});
    console.log('🗑️  Cleared existing messages');

    const recruiter = users.find(user => user.isRecruiter);
    const interviewer = users.find(user => user.isInterviewer);
    
    if (chatRoom && recruiter && interviewer) {
      const messages = [
        {
          chatRoomId: chatRoom._id,
          recruiterId: recruiter._id,
          interviewerId: interviewer._id,
          senderId: recruiter._id,
          content: 'Hello! I would like to discuss the interview process for the Senior Full Stack Developer position.',
          isRead: true,
          messageType: 'text',
        },
        {
          chatRoomId: chatRoom._id,
          recruiterId: recruiter._id,
          interviewerId: interviewer._id,
          senderId: interviewer._id,
          content: 'Hi! I would be happy to help with the interview process. When would you like to schedule it?',
          isRead: true,
          messageType: 'text',
        },
      ];

      const createdMessages = await Message.insertMany(messages);
      console.log(`✅ Created ${createdMessages.length} messages`);
      return createdMessages;
    }
  } catch (error) {
    console.error('❌ Error seeding messages:', error);
    throw error;
  }
};

const seedContracts = async (users, jobs, chatRoom) => {
  try {
    // Clear existing contracts
    await Contract.deleteMany({});
    console.log('🗑️  Cleared existing contracts');

    const recruiter = users.find(user => user.isRecruiter);
    const interviewer = users.find(user => user.isInterviewer);
    
    if (recruiter && interviewer && jobs.length > 0 && chatRoom) {
      const contract = {
        agreedPrice: 500.00,
        status: 'pending',
        paymentStatus: 'pending',
        recruiterId: recruiter._id,
        interviewerId: interviewer._id,
        jobId: jobs[0]._id,
        roomId: chatRoom._id,
      };

      const createdContract = await Contract.create(contract);
      console.log('✅ Created contract');
      return createdContract;
    }
  } catch (error) {
    console.error('❌ Error seeding contracts:', error);
    throw error;
  }
};

const seedInterviews = async (users, jobs, applications) => {
  try {
    // Clear existing interviews
    await Interview.deleteMany({});
    console.log('🗑️  Cleared existing interviews');

    const interviewer = users.find(user => user.isInterviewer);
    const candidate = users.find(user => user.isCandidate);
    
    if (interviewer && candidate && jobs.length > 0 && applications.length > 0) {
      const interview = {
        roomId: 'interview-room-123',
        scheduledTime: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
        interviewerId: interviewer._id,
        candidateId: candidate._id,
        jobId: jobs[0]._id,
        applicationId: applications[0]._id,
        status: 'scheduled',
        remarks: 'Initial screening interview',
        summary: 'Technical interview for full-stack developer position',
        rating: 4.5,
      };

      const createdInterview = await Interview.create(interview);
      console.log('✅ Created interview');
      return createdInterview;
    }
  } catch (error) {
    console.error('❌ Error seeding interviews:', error);
    throw error;
  }
};

const seedInterviewerRatings = async (users, jobs, contract) => {
  try {
    // Clear existing interviewer ratings
    await InterviewerRating.deleteMany({});
    console.log('🗑️  Cleared existing interviewer ratings');

    const recruiter = users.find(user => user.isRecruiter);
    const interviewer = users.find(user => user.isInterviewer);
    
    if (recruiter && interviewer && jobs.length > 0 && contract) {
      const rating = {
        rating: 4.8,
        feedback: 'Excellent interviewer with great communication skills and technical expertise. Highly recommended for future interviews.',
        interviewerId: interviewer._id,
        recruiterId: recruiter._id,
        jobId: jobs[0]._id,
        contractId: contract._id,
      };

      const createdRating = await InterviewerRating.create(rating);
      console.log('✅ Created interviewer rating');
      return createdRating;
    }
  } catch (error) {
    console.error('❌ Error seeding interviewer ratings:', error);
    throw error;
  }
};

const seedTransactions = async (contract) => {
  try {
    // Clear existing transactions
    await Transaction.deleteMany({});
    console.log('🗑️  Cleared existing transactions');

    if (contract) {
      const transaction = {
        amount: 500.00,
        status: 'pending',
        transactionDate: new Date(),
        transactionType: 'payment',
        contractId: contract._id,
        platformFee: 12.50,
        netAmount: 487.50,
      };

      const createdTransaction = await Transaction.create(transaction);
      console.log('✅ Created transaction');
      return createdTransaction;
    }
  } catch (error) {
    console.error('❌ Error seeding transactions:', error);
    throw error;
  }
};

const runSeeder = async () => {
  try {
    console.log('🌱 Starting MongoDB seeder...');
    
    await connectDB();
    
    // Seed data in order
    const users = await seedUsers();
    await seedResumes(users);
    const jobs = await seedJobs(users);
    const applications = await seedApplications(users, jobs);
    const chatRoom = await seedChatRooms(users, jobs);
    await seedMessages(chatRoom, users);
    const contract = await seedContracts(users, jobs, chatRoom);
    await seedInterviews(users, jobs, applications);
    await seedInterviewerRatings(users, jobs, contract);
    await seedTransactions(contract);
    
    console.log('🎉 Seeding completed successfully!');
    console.log('\n📋 Test Accounts:');
    console.log('Admin: admin@ezyjobs.com / Admin@123');
    console.log('Recruiter: recruiter@ezyjobs.com / Recruiter@123');
    console.log('Interviewer: interviewer@ezyjobs.com / Interviewer@123');
    console.log('Candidate: candidate@ezyjobs.com / Candidate@123');
    
  } catch (error) {
    console.error('❌ Seeding failed:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
    process.exit(0);
  }
};

// Run seeder if this file is executed directly
if (require.main === module) {
  runSeeder();
}

module.exports = {
  runSeeder,
  seedUsers,
  seedResumes,
  seedJobs,
  seedApplications,
  seedChatRooms,
  seedMessages,
  seedContracts,
  seedInterviews,
  seedInterviewerRatings,
  seedTransactions,
};
