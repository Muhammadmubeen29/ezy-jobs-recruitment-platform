// 'use strict';

// const bcrypt = require('bcryptjs');
// const mongoose = require('mongoose');
// require('dotenv').config();

// // Import models
// const User = require('../models/user');
// const Resume = require('../models/resume');
// const Job = require('../models/job');
// const Application = require('../models/application');
// const ChatRoom = require('../models/chatroom');
// const Message = require('../models/message');
// const Contract = require('../models/contract');
// const Interview = require('../models/interview');
// const InterviewerRating = require('../models/interviewerrating');
// const Transaction = require('../models/transaction');

// const connectDB = async () => {
//   try {
//     const mongoURI = process.env.MONGODB_URI || process.env.DATABASE_URL;
    
//     if (!mongoURI) {
//       throw new Error('MongoDB URI not found in environment variables');
//     }

//     await mongoose.connect(mongoURI);
//     console.log('✅ Connected to MongoDB');
//   } catch (error) {
//     console.error('❌ MongoDB connection error:', error);
//     process.exit(1);
//   }
// };

// const seedUsers = async () => {
//   try {
//     // Clear existing users
//     await User.deleteMany({});
//     console.log('🗑️  Cleared existing users');

//     const users = [
//       {
//         firstName: 'Muhammad Mubeen',
//         lastName: 'Mukhtar Rana',
//         email: 'admin@ezyjobs.com',
//         phone: '+923229396560',
//         password: await bcrypt.hash('Admin@123', 10),
//         isVerified: true,
//         isLinkedinVerified: false,
//         isAdmin: true,
//         isRecruiter: false,
//         isInterviewer: false,
//         isCandidate: false,
//         isTopRated: false,
//         stripeAccountId: null,
//         stripeCustomerId: null,
//         stripeAccountStatus: null,
//         payoutEnabled: false,
//       },
//       {
//         firstName: 'Pakeeza',
//         lastName: 'Hassan',
//         email: 'recruiter@ezyjobs.com',
//         phone: '+923002222222',
//         password: await bcrypt.hash('Recruiter@123', 10),
//         isVerified: true,
//         isLinkedinVerified: true,
//         isAdmin: false,
//         isRecruiter: true,
//         isInterviewer: false,
//         isCandidate: false,
//         isTopRated: true,
//         stripeAccountId: null,
//         stripeCustomerId: 'cus_recruiter123',
//         stripeAccountStatus: null,
//         payoutEnabled: false,
//       },
//       {
//         firstName: 'Iqra',
//         lastName: 'Zafar',
//         email: 'interviewer@ezyjobs.com',
//         phone: '+923003333333',
//         password: await bcrypt.hash('Interviewer@123', 10),
//         isVerified: true,
//         isLinkedinVerified: true,
//         isAdmin: false,
//         isRecruiter: false,
//         isInterviewer: true,
//         isCandidate: false,
//         isTopRated: true,
//         stripeAccountId: 'acct_interviewer123',
//         stripeCustomerId: null,
//         stripeAccountStatus: 'verified',
//         payoutEnabled: true,
//       },
//       {
//         firstName: 'Airej',
//         lastName: 'Tashfeen',
//         email: 'candidate@ezyjobs.com',
//         phone: '+923004444444',
//         password: await bcrypt.hash('Candidate@123', 10),
//         isVerified: true,
//         isLinkedinVerified: false,
//         isAdmin: false,
//         isRecruiter: false,
//         isInterviewer: false,
//         isCandidate: true,
//         isTopRated: false,
//         stripeAccountId: null,
//         stripeCustomerId: null,
//         stripeAccountStatus: null,
//         payoutEnabled: false,
//       },
//     ];

//     const createdUsers = await User.insertMany(users);
//     console.log(`✅ Created ${createdUsers.length} users`);
//     return createdUsers;
//   } catch (error) {
//     console.error('❌ Error seeding users:', error);
//     throw error;
//   }
// };

// const seedResumes = async (users) => {
//   try {
//     // Clear existing resumes
//     await Resume.deleteMany({});
//     console.log('🗑️  Cleared existing resumes');

//     const candidate = users.find(user => user.isCandidate);
    
//     if (candidate) {
//       const resume = {
//         title: 'Full Stack Developer',
//         summary: 'Experienced full-stack developer with 3+ years of experience in React, Node.js, and MongoDB. Passionate about creating scalable web applications and solving complex problems.',
//         headline: 'Full Stack Developer | React | Node.js | MongoDB',
//         skills: ['JavaScript', 'React', 'Node.js', 'MongoDB', 'Express.js', 'HTML', 'CSS', 'Git'],
//         experience: '3+ years of experience in full-stack development. Worked on various projects including e-commerce platforms, social media applications, and enterprise solutions.',
//         education: 'Bachelor of Science in Computer Science from University of Technology',
//         industry: 'Information Technology',
//         availability: 'Two weeks',
//         company: 'Tech Solutions Inc.',
//         achievements: 'Led development of a high-traffic e-commerce platform serving 100k+ users. Implemented microservices architecture resulting in 40% performance improvement.',
//         portfolio: 'https://saraahmed.dev',
//         userId: candidate._id,
//       };

//       await Resume.create(resume);
//       console.log('✅ Created resume for candidate');
//     }
//   } catch (error) {
//     console.error('❌ Error seeding resumes:', error);
//     throw error;
//   }
// };

// const seedJobs = async (users) => {
//   try {
//     // Clear existing jobs
//     await Job.deleteMany({});
//     console.log('🗑️  Cleared existing jobs');

//     const recruiter = users.find(user => user.isRecruiter);
    
//     if (recruiter) {
//       const jobs = [
//         {
//           title: 'Senior Full Stack Developer',
//           description: 'We are looking for a Senior Full Stack Developer to join our dynamic team. You will be responsible for developing and maintaining web applications using modern technologies.',
//           company: 'TechCorp Solutions',
//           requirements: '5+ years of experience in full-stack development, proficiency in React, Node.js, and MongoDB, experience with cloud platforms, strong problem-solving skills.',
//           benefits: 'Competitive salary, health insurance, flexible working hours, professional development opportunities, team building activities.',
//           salaryRange: '$80k - $120k',
//           category: 'IT',
//           location: 'New York, NY',
//           recruiterId: recruiter._id,
//           isClosed: false,
//         },
//         {
//           title: 'Frontend Developer',
//           description: 'Join our frontend team to create amazing user experiences. We are looking for a creative and skilled frontend developer.',
//           company: 'Design Studio',
//           requirements: '3+ years of frontend development experience, expertise in React, TypeScript, and modern CSS frameworks, experience with responsive design.',
//           benefits: 'Remote work options, creative environment, latest tools and technologies, mentorship program.',
//           salaryRange: '$60k - $90k',
//           category: 'IT',
//           location: 'San Francisco, CA',
//           recruiterId: recruiter._id,
//           isClosed: false,
//         },
//       ];

//       const createdJobs = await Job.insertMany(jobs);
//       console.log(`✅ Created ${createdJobs.length} jobs`);
//       return createdJobs;
//     }
//   } catch (error) {
//     console.error('❌ Error seeding jobs:', error);
//     throw error;
//   }
// };

// const seedApplications = async (users, jobs) => {
//   try {
//     // Clear existing applications
//     await Application.deleteMany({});
//     console.log('🗑️  Cleared existing applications');

//     const candidate = users.find(user => user.isCandidate);
    
//     if (candidate && jobs.length > 0) {
//       const applications = [
//         {
//           status: 'applied',
//           applicationDate: new Date(),
//           jobId: jobs[0]._id,
//           candidateId: candidate._id,
//         },
//         {
//           status: 'shortlisted',
//           applicationDate: new Date(),
//           jobId: jobs[1]._id,
//           candidateId: candidate._id,
//         },
//       ];

//       const createdApplications = await Application.insertMany(applications);
//       console.log(`✅ Created ${createdApplications.length} applications`);
//       return createdApplications;
//     }
//   } catch (error) {
//     console.error('❌ Error seeding applications:', error);
//     throw error;
//   }
// };

// const seedChatRooms = async (users, jobs) => {
//   try {
//     // Clear existing chat rooms
//     await ChatRoom.deleteMany({});
//     console.log('🗑️  Cleared existing chat rooms');

//     const recruiter = users.find(user => user.isRecruiter);
//     const interviewer = users.find(user => user.isInterviewer);
    
//     if (recruiter && interviewer && jobs.length > 0) {
//       const chatRoom = {
//         recruiterId: recruiter._id,
//         interviewerId: interviewer._id,
//         jobId: jobs[0]._id,
//       };

//       const createdChatRoom = await ChatRoom.create(chatRoom);
//       console.log('✅ Created chat room');
//       return createdChatRoom;
//     }
//   } catch (error) {
//     console.error('❌ Error seeding chat rooms:', error);
//     throw error;
//   }
// };

// const seedMessages = async (chatRoom, users) => {
//   try {
//     // Clear existing messages
//     await Message.deleteMany({});
//     console.log('🗑️  Cleared existing messages');

//     const recruiter = users.find(user => user.isRecruiter);
//     const interviewer = users.find(user => user.isInterviewer);
    
//     if (chatRoom && recruiter && interviewer) {
//       const messages = [
//         {
//           chatRoomId: chatRoom._id,
//           recruiterId: recruiter._id,
//           interviewerId: interviewer._id,
//           senderId: recruiter._id,
//           content: 'Hello! I would like to discuss the interview process for the Senior Full Stack Developer position.',
//           isRead: true,
//           messageType: 'text',
//         },
//         {
//           chatRoomId: chatRoom._id,
//           recruiterId: recruiter._id,
//           interviewerId: interviewer._id,
//           senderId: interviewer._id,
//           content: 'Hi! I would be happy to help with the interview process. When would you like to schedule it?',
//           isRead: true,
//           messageType: 'text',
//         },
//       ];

//       const createdMessages = await Message.insertMany(messages);
//       console.log(`✅ Created ${createdMessages.length} messages`);
//       return createdMessages;
//     }
//   } catch (error) {
//     console.error('❌ Error seeding messages:', error);
//     throw error;
//   }
// };

// const seedContracts = async (users, jobs, chatRoom) => {
//   try {
//     // Clear existing contracts
//     await Contract.deleteMany({});
//     console.log('🗑️  Cleared existing contracts');

//     const recruiter = users.find(user => user.isRecruiter);
//     const interviewer = users.find(user => user.isInterviewer);
    
//     if (recruiter && interviewer && jobs.length > 0 && chatRoom) {
//       const contract = {
//         agreedPrice: 500.00,
//         status: 'pending',
//         paymentStatus: 'pending',
//         recruiterId: recruiter._id,
//         interviewerId: interviewer._id,
//         jobId: jobs[0]._id,
//         roomId: chatRoom._id,
//       };

//       const createdContract = await Contract.create(contract);
//       console.log('✅ Created contract');
//       return createdContract;
//     }
//   } catch (error) {
//     console.error('❌ Error seeding contracts:', error);
//     throw error;
//   }
// };

// const seedInterviews = async (users, jobs, applications) => {
//   try {
//     // Clear existing interviews
//     await Interview.deleteMany({});
//     console.log('🗑️  Cleared existing interviews');

//     const interviewer = users.find(user => user.isInterviewer);
//     const candidate = users.find(user => user.isCandidate);
    
//     if (interviewer && candidate && jobs.length > 0 && applications.length > 0) {
//       const interview = {
//         roomId: 'interview-room-123',
//         scheduledTime: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
//         interviewerId: interviewer._id,
//         candidateId: candidate._id,
//         jobId: jobs[0]._id,
//         applicationId: applications[0]._id,
//         status: 'scheduled',
//         remarks: 'Initial screening interview',
//         summary: 'Technical interview for full-stack developer position',
//         rating: 4.5,
//       };

//       const createdInterview = await Interview.create(interview);
//       console.log('✅ Created interview');
//       return createdInterview;
//     }
//   } catch (error) {
//     console.error('❌ Error seeding interviews:', error);
//     throw error;
//   }
// };

// const seedInterviewerRatings = async (users, jobs, contract) => {
//   try {
//     // Clear existing interviewer ratings
//     await InterviewerRating.deleteMany({});
//     console.log('🗑️  Cleared existing interviewer ratings');

//     const recruiter = users.find(user => user.isRecruiter);
//     const interviewer = users.find(user => user.isInterviewer);
    
//     if (recruiter && interviewer && jobs.length > 0 && contract) {
//       const rating = {
//         rating: 4.8,
//         feedback: 'Excellent interviewer with great communication skills and technical expertise. Highly recommended for future interviews.',
//         interviewerId: interviewer._id,
//         recruiterId: recruiter._id,
//         jobId: jobs[0]._id,
//         contractId: contract._id,
//       };

//       const createdRating = await InterviewerRating.create(rating);
//       console.log('✅ Created interviewer rating');
//       return createdRating;
//     }
//   } catch (error) {
//     console.error('❌ Error seeding interviewer ratings:', error);
//     throw error;
//   }
// };

// const seedTransactions = async (contract) => {
//   try {
//     // Clear existing transactions
//     await Transaction.deleteMany({});
//     console.log('🗑️  Cleared existing transactions');

//     if (contract) {
//       const transaction = {
//         amount: 500.00,
//         status: 'pending',
//         transactionDate: new Date(),
//         transactionType: 'payment',
//         contractId: contract._id,
//         platformFee: 12.50,
//         netAmount: 487.50,
//       };

//       const createdTransaction = await Transaction.create(transaction);
//       console.log('✅ Created transaction');
//       return createdTransaction;
//     }
//   } catch (error) {
//     console.error('❌ Error seeding transactions:', error);
//     throw error;
//   }
// };

// const runSeeder = async () => {
//   try {
//     console.log('🌱 Starting MongoDB seeder...');
    
//     await connectDB();
    
//     // Seed data in order
//     const users = await seedUsers();
//     await seedResumes(users);
//     const jobs = await seedJobs(users);
//     const applications = await seedApplications(users, jobs);
//     const chatRoom = await seedChatRooms(users, jobs);
//     await seedMessages(chatRoom, users);
//     const contract = await seedContracts(users, jobs, chatRoom);
//     await seedInterviews(users, jobs, applications);
//     await seedInterviewerRatings(users, jobs, contract);
//     await seedTransactions(contract);
    
//     console.log('🎉 Seeding completed successfully!');
//     console.log('\n📋 Test Accounts:');
//     console.log('Admin: admin@ezyjobs.com / Admin@123');
//     console.log('Recruiter: recruiter@ezyjobs.com / Recruiter@123');
//     console.log('Interviewer: interviewer@ezyjobs.com / Interviewer@123');
//     console.log('Candidate: candidate@ezyjobs.com / Candidate@123');
    
//   } catch (error) {
//     console.error('❌ Seeding failed:', error);
//   } finally {
//     await mongoose.connection.close();
//     console.log('🔌 Database connection closed');
//     process.exit(0);
//   }
// };

// // Run seeder if this file is executed directly
// if (require.main === module) {
//   runSeeder();
// }

// module.exports = {
//   runSeeder,
//   seedUsers,
//   seedResumes,
//   seedJobs,
//   seedApplications,
//   seedChatRooms,
//   seedMessages,
//   seedContracts,
//   seedInterviews,
//   seedInterviewerRatings,
//   seedTransactions,
// };

'use strict';

const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
require('dotenv').config();

// Models
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
    if (!mongoURI) throw new Error('MongoDB URI not found');
    await mongoose.connect(mongoURI);
    console.log('✅ Connected to MongoDB');
  } catch (err) {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  }
};

// ---------------------- Seed Users ----------------------
const seedUsers = async () => {
  try {
    await User.deleteMany({});
    console.log('🗑️  Cleared existing users');

    const users = [
      // Admin
      {
        firstName: 'Muhammad Mubeen',
        lastName: 'Mukhtar Rana',
        email: 'admin@ezyjobs.com',
        phone: '+923229396560',
        password: await bcrypt.hash('Admin@123', 10),
        isVerified: true,
        isAdmin: true,
      },
      // Recruiters
      {
        firstName: 'Pakeeza',
        lastName: 'Hassan',
        email: 'recruiter1@ezyjobs.com',
        phone: '+923001111111',
        password: await bcrypt.hash('Recruiter@123', 10),
        isVerified: true,
        isRecruiter: true,
      },
      {
        firstName: 'Ali',
        lastName: 'Raza',
        email: 'recruiter2@ezyjobs.com',
        phone: '+923002222222',
        password: await bcrypt.hash('Recruiter@123', 10),
        isVerified: true,
        isRecruiter: true,
      },
      // Interviewers
      {
        firstName: 'Iqra',
        lastName: 'Zafar',
        email: 'interviewer1@ezyjobs.com',
        phone: '+923003333333',
        password: await bcrypt.hash('Interviewer@123', 10),
        isVerified: true,
        isInterviewer: true,
      },
      {
        firstName: 'Ahmed',
        lastName: 'Khan',
        email: 'interviewer2@ezyjobs.com',
        phone: '+923004444444',
        password: await bcrypt.hash('Interviewer@123', 10),
        isVerified: true,
        isInterviewer: true,
      },
      // Candidates
      {
        firstName: 'Airej',
        lastName: 'Tashfeen',
        email: 'candidate1@ezyjobs.com',
        phone: '+923005555555',
        password: await bcrypt.hash('Candidate@123', 10),
        isVerified: true,
        isCandidate: true,
      },
      {
        firstName: 'Sara',
        lastName: 'Ahmed',
        email: 'candidate2@ezyjobs.com',
        phone: '+923006666666',
        password: await bcrypt.hash('Candidate@123', 10),
        isVerified: true,
        isCandidate: true,
      },
      {
        firstName: 'Hassan',
        lastName: 'Ali',
        email: 'candidate3@ezyjobs.com',
        phone: '+923007777777',
        password: await bcrypt.hash('Candidate@123', 10),
        isVerified: true,
        isCandidate: true,
      },
      {
        firstName: 'Ayesha',
        lastName: 'Yousaf',
        email: 'candidate4@ezyjobs.com',
        phone: '+923008888888',
        password: await bcrypt.hash('Candidate@123', 10),
        isVerified: true,
        isCandidate: true,
      },
      {
        firstName: 'Owais',
        lastName: 'Shah',
        email: 'candidate5@ezyjobs.com',
        phone: '+923009999999',
        password: await bcrypt.hash('Candidate@123', 10),
        isVerified: true,
        isCandidate: true,
      },
    ];

    const createdUsers = await User.insertMany(users);
    console.log(`✅ Created ${createdUsers.length} users`);
    return createdUsers;
  } catch (err) {
    console.error('❌ Error seeding users:', err);
    throw err;
  }
};

// ---------------------- Seed Resumes ----------------------
const seedResumes = async (users) => {
  try {
    await Resume.deleteMany({});
    console.log('🗑️  Cleared existing resumes');

    const candidates = users.filter(u => u.isCandidate);
    const resumes = candidates.map((candidate, i) => ({
      title: `Full Stack Developer ${i + 1}`,
      summary: `Experienced full-stack developer with expertise in Node.js, React, MongoDB, and modern web technologies. Passionate about building scalable applications and solving complex problems.`,
      headline: `Full Stack Developer | MERN Stack | Node.js | React.js | MongoDB`,
      skills: ['JavaScript', 'React', 'Node.js', 'MongoDB', 'Express.js', 'HTML', 'CSS', 'Git'],
      experience: '3+ years of experience in full-stack development working on diverse projects.',
      education: 'BSc in Computer Science from top Pakistani universities.',
      industry: 'Information Technology',
      availability: 'Immediate',
      company: 'Tech Solutions Pvt Ltd',
      achievements: 'Delivered multiple high-traffic applications with optimized performance.',
      portfolio: 'https://portfolio.example.com',
      userId: candidate._id,
    }));

    await Resume.insertMany(resumes);
    console.log(`✅ Created ${resumes.length} resumes`);
  } catch (err) {
    console.error('❌ Error seeding resumes:', err);
    throw err;
  }
};

// ---------------------- Seed Jobs ----------------------
const seedJobs = async (users) => {
  try {
    await Job.deleteMany({});
    console.log('🗑️  Cleared existing jobs');

    const recruiters = users.filter(u => u.isRecruiter);
    const jobs = [];

    recruiters.forEach((recruiter, rIdx) => {
      for (let j = 1; j <= 5; j++) {
        jobs.push({
          title: `Job Position ${j} by ${recruiter.firstName}`,
          description: `We are looking for a skilled professional for Job Position ${j}. Must have expertise in web development and team collaboration.`,
          company: `Company ${j} Pvt Ltd`,
          requirements: '3+ years of experience, proficiency in modern web technologies, and strong problem-solving skills.',
          benefits: 'Competitive salary, health insurance, flexible hours, and professional growth opportunities.',
          salaryRange: `$${50 + j}k - $${60 + j}k`,
          category: 'IT',
          location: 'Karachi, Pakistan',
          recruiterId: recruiter._id,
          isClosed: false,
        });
      }
    });

    const createdJobs = await Job.insertMany(jobs);
    console.log(`✅ Created ${createdJobs.length} jobs`);
    return createdJobs;
  } catch (err) {
    console.error('❌ Error seeding jobs:', err);
    throw err;
  }
};

// ---------------------- Seed Applications ----------------------
const seedApplications = async (users, jobs) => {
  await Application.deleteMany({});
  console.log('🗑️  Cleared existing applications');

  const candidates = users.filter(u => u.isCandidate);

  const applications = [];

  candidates.forEach((candidate) => {
    jobs.forEach((job) => {
      applications.push({
        status: 'applied',
        applicationDate: new Date(),
        jobId: job._id,
        candidateId: candidate._id,
      });
    });
  });

  const createdApplications = await Application.insertMany(applications);
  console.log(`✅ Created ${createdApplications.length} applications`);
  return createdApplications;
};

// ---------------------- Seed ChatRooms & Messages ----------------------
const seedChatRoomsAndMessages = async (users, jobs) => {
  try {
    await ChatRoom.deleteMany({});
    await Message.deleteMany({});
    console.log('🗑️  Cleared chat rooms and messages');

    const recruiters = users.filter(u => u.isRecruiter);
    const interviewers = users.filter(u => u.isInterviewer);

    const chatRooms = [];
    const messages = [];

    for (let i = 0; i < 5; i++) {
      const chatRoom = await ChatRoom.create({
        recruiterId: recruiters[i % recruiters.length]._id,
        interviewerId: interviewers[i % interviewers.length]._id,
        jobId: jobs[i]._id,
      });
      chatRooms.push(chatRoom);

      messages.push(
        {
          chatRoomId: chatRoom._id,
          recruiterId: chatRoom.recruiterId,
          interviewerId: chatRoom.interviewerId,
          senderId: chatRoom.recruiterId,
          content: 'Hello! Let’s discuss the interview process.',
          isRead: true,
          messageType: 'text',
        },
        {
          chatRoomId: chatRoom._id,
          recruiterId: chatRoom.recruiterId,
          interviewerId: chatRoom.interviewerId,
          senderId: chatRoom.interviewerId,
          content: 'Sure! When should we schedule the interview?',
          isRead: true,
          messageType: 'text',
        }
      );
    }

    await Message.insertMany(messages);
    console.log(`✅ Created ${messages.length} messages in ${chatRooms.length} chat rooms`);
    return chatRooms;
  } catch (err) {
    console.error('❌ Error seeding chat rooms/messages:', err);
    throw err;
  }
};

// ---------------------- Seed Contracts, Interviews, Ratings, Transactions ----------------------
const seedContractsAndRelated = async (users, jobs, chatRooms, applications) => {
  try {
    await Contract.deleteMany({});
    await Interview.deleteMany({});
    await InterviewerRating.deleteMany({});
    await Transaction.deleteMany({});
    console.log('🗑️  Cleared contracts, interviews, ratings, and transactions');

    const recruiters = users.filter(u => u.isRecruiter);
    const interviewers = users.filter(u => u.isInterviewer);
    const candidates = users.filter(u => u.isCandidate);

    for (let i = 0; i < 5; i++) {
      const contract = await Contract.create({
        agreedPrice: 500 + i * 50,
        status: 'pending',
        paymentStatus: 'pending',
        recruiterId: recruiters[i % recruiters.length]._id,
        interviewerId: interviewers[i % interviewers.length]._id,
        jobId: jobs[i]._id,
        roomId: chatRooms[i]._id,
      });

      await Interview.create({
        roomId: `interview-room-${i}`,
        scheduledTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
        interviewerId: interviewers[i % interviewers.length]._id,
        candidateId: candidates[i % candidates.length]._id,
        jobId: jobs[i]._id,
        applicationId: applications[i % applications.length]._id,
        status: 'scheduled',
        remarks: 'Initial screening interview',
        summary: 'Technical interview for full-stack developer position',
        rating: 4 + i * 0.1,
      });

      await InterviewerRating.create({
        rating: 4 + i * 0.2,
        feedback: 'Excellent interviewer with strong technical skills and communication.',
        interviewerId: interviewers[i % interviewers.length]._id,
        recruiterId: recruiters[i % recruiters.length]._id,
        jobId: jobs[i]._id,
        contractId: contract._id,
      });

      await Transaction.create({
        amount: contract.agreedPrice,
        status: 'pending',
        transactionDate: new Date(),
        transactionType: 'payment',
        contractId: contract._id,
        platformFee: contract.agreedPrice * 0.025,
        netAmount: contract.agreedPrice * 0.975,
      });
    }

    console.log('✅ Contracts, interviews, ratings, and transactions created');
  } catch (err) {
    console.error('❌ Error seeding contracts/interviews/ratings/transactions:', err);
    throw err;
  }
};

// ---------------------- Run Seeder ----------------------
const runSeeder = async () => {
  try {
    console.log('🌱 Starting MongoDB seeder...');
    await connectDB();

    const users = await seedUsers();
    await seedResumes(users);
    const jobs = await seedJobs(users);
    const applications = await seedApplications(users, jobs);
    const chatRooms = await seedChatRoomsAndMessages(users, jobs);
    await seedContractsAndRelated(users, jobs, chatRooms, applications);

    console.log('🎉 Seeding completed successfully!');
    console.log('\n📋 Test Accounts:');
    console.log('Admin: admin@ezyjobs.com / Admin@123');
    console.log('Recruiter1: recruiter1@ezyjobs.com / Recruiter@123');
    console.log('Recruiter2: recruiter2@ezyjobs.com / Recruiter@123');
    console.log('Interviewer1: interviewer1@ezyjobs.com / Interviewer@123');
    console.log('Interviewer2: interviewer2@ezyjobs.com / Interviewer@123');
    console.log('Candidate1: candidate1@ezyjobs.com / Candidate@123');
    console.log('Candidate2: candidate2@ezyjobs.com / Candidate@123');

  } catch (err) {
    console.error('❌ Seeding failed:', err);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
    process.exit(0);
  }
};

// Run if executed directly
if (require.main === module) runSeeder();

module.exports = {
  runSeeder,
};