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

const { generateRoomId, generateRemarks } = require('../utils/interview.utils');

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

// Helper function to generate unique room IDs
const generateUniqueRoomId = () => {
  const timestamp = Date.now().toString(36);
  const randomChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const randomPart = Array.from({ length: 6 }, () =>
    randomChars.charAt(Math.floor(Math.random() * randomChars.length))
  ).join('');
  return `room-${timestamp.slice(-4)}-${randomPart}`;
};

// ==================== SEED USERS ====================
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
        phone: '+923001234567',
        password: await bcrypt.hash('Admin@123', 10),
        isVerified: true,
        isAdmin: true,
        isRecruiter: false,
        isInterviewer: false,
        isCandidate: false,
      },
      // 10 Recruiters
      {
        firstName: 'Usman',
        lastName: 'Sheikh',
        email: 'usman.sheikh@orbitsoft.pk',
        phone: '+923112345001',
        password: await bcrypt.hash('Recruiter@123', 10),
        isVerified: true,
        isRecruiter: true,
        isInterviewer: false,
        isCandidate: false,
      },
      {
        firstName: 'Hira',
        lastName: 'Aslam',
        email: 'hira.aslam@nextbridge.pk',
        phone: '+923112345002',
        password: await bcrypt.hash('Recruiter@123', 10),
        isVerified: true,
        isRecruiter: true,
        isInterviewer: false,
        isCandidate: false,
      },
      {
        firstName: 'Bilal',
        lastName: 'Murtaza',
        email: 'bilal.murtaza@creative-labs.com',
        phone: '+923112345003',
        password: await bcrypt.hash('Recruiter@123', 10),
        isVerified: true,
        isRecruiter: true,
        isInterviewer: false,
        isCandidate: false,
      },
      {
        firstName: 'Maham',
        lastName: 'Fayyaz',
        email: 'maham.fayyaz@teksmiths.com',
        phone: '+923112345004',
        password: await bcrypt.hash('Recruiter@123', 10),
        isVerified: true,
        isRecruiter: true,
        isInterviewer: false,
        isCandidate: false,
      },
      {
        firstName: 'Jibran',
        lastName: 'Arif',
        email: 'jibran.arif@logicon.com',
        phone: '+923112345005',
        password: await bcrypt.hash('Recruiter@123', 10),
        isVerified: true,
        isRecruiter: true,
        isInterviewer: false,
        isCandidate: false,
      },
      {
        firstName: 'Nimra',
        lastName: 'Hussain',
        email: 'nimra.hussain@microtech.pk',
        phone: '+923112345006',
        password: await bcrypt.hash('Recruiter@123', 10),
        isVerified: true,
        isRecruiter: true,
        isInterviewer: false,
        isCandidate: false,
      },
      {
        firstName: 'Zeeshan',
        lastName: 'Qamar',
        email: 'zeeshan.qamar@alphacode.pk',
        phone: '+923112345007',
        password: await bcrypt.hash('Recruiter@123', 10),
        isVerified: true,
        isRecruiter: true,
        isInterviewer: false,
        isCandidate: false,
      },
      {
        firstName: 'Maria',
        lastName: 'Khalid',
        email: 'maria.khalid@cybercloud.pk',
        phone: '+923112345008',
        password: await bcrypt.hash('Recruiter@123', 10),
        isVerified: true,
        isRecruiter: true,
        isInterviewer: false,
        isCandidate: false,
      },
      {
        firstName: 'Hamza',
        lastName: 'Javed',
        email: 'hamza.javed@bluefox.pk',
        phone: '+923112345009',
        password: await bcrypt.hash('Recruiter@123', 10),
        isVerified: true,
        isRecruiter: true,
        isInterviewer: false,
        isCandidate: false,
      },
      {
        firstName: 'Ayesha',
        lastName: 'Malik',
        email: 'ayesha.malik@techflow.pk',
        phone: '+923112345010',
        password: await bcrypt.hash('Recruiter@123', 10),
        isVerified: true,
        isRecruiter: true,
        isInterviewer: false,
        isCandidate: false,
      },
      // 10 Interviewers
      {
        firstName: 'Areeba',
        lastName: 'Naz',
        email: 'areeba.naz@interviewers.com',
        phone: '+923223450001',
        password: await bcrypt.hash('Interviewer@123', 10),
        isVerified: true,
        isInterviewer: true,
        isRecruiter: false,
        isCandidate: false,
      },
      {
        firstName: 'Saad',
        lastName: 'Hassan',
        email: 'saad.hassan@interviewers.com',
        phone: '+923223450002',
        password: await bcrypt.hash('Interviewer@123', 10),
        isVerified: true,
        isInterviewer: true,
        isRecruiter: false,
        isCandidate: false,
      },
      {
        firstName: 'Fatima',
        lastName: 'Shah',
        email: 'fatima.shah@interviewers.com',
        phone: '+923223450003',
        password: await bcrypt.hash('Interviewer@123', 10),
        isVerified: true,
        isInterviewer: true,
        isRecruiter: false,
        isCandidate: false,
      },
      {
        firstName: 'Moiz',
        lastName: 'Rafiq',
        email: 'moiz.rafiq@interviewers.com',
        phone: '+923223450004',
        password: await bcrypt.hash('Interviewer@123', 10),
        isVerified: true,
        isInterviewer: true,
        isRecruiter: false,
        isCandidate: false,
      },
      {
        firstName: 'Zara',
        lastName: 'Qureshi',
        email: 'zara.qureshi@interviewers.com',
        phone: '+923223450005',
        password: await bcrypt.hash('Interviewer@123', 10),
        isVerified: true,
        isInterviewer: true,
        isRecruiter: false,
        isCandidate: false,
      },
      {
        firstName: 'Umer',
        lastName: 'Nadeem',
        email: 'umer.nadeem@interviewers.com',
        phone: '+923223450006',
        password: await bcrypt.hash('Interviewer@123', 10),
        isVerified: true,
        isInterviewer: true,
        isRecruiter: false,
        isCandidate: false,
      },
      {
        firstName: 'Alizeh',
        lastName: 'Iqbal',
        email: 'alizeh.iqbal@interviewers.com',
        phone: '+923223450007',
        password: await bcrypt.hash('Interviewer@123', 10),
        isVerified: true,
        isInterviewer: true,
        isRecruiter: false,
        isCandidate: false,
      },
      {
        firstName: 'Daniyal',
        lastName: 'Kiani',
        email: 'daniyal.kiani@interviewers.com',
        phone: '+923223450008',
        password: await bcrypt.hash('Interviewer@123', 10),
        isVerified: true,
        isInterviewer: true,
        isRecruiter: false,
        isCandidate: false,
      },
      {
        firstName: 'Iqra',
        lastName: 'Shehzad',
        email: 'iqra.shehzad@interviewers.com',
        phone: '+923223450009',
        password: await bcrypt.hash('Interviewer@123', 10),
        isVerified: true,
        isInterviewer: true,
        isRecruiter: false,
        isCandidate: false,
      },
      {
        firstName: 'Taimoor',
        lastName: 'Ahmed',
        email: 'taimoor.ahmed@interviewers.com',
        phone: '+923223450010',
        password: await bcrypt.hash('Interviewer@123', 10),
        isVerified: true,
        isInterviewer: true,
        isRecruiter: false,
        isCandidate: false,
      },
    ];

    // Generate 50 Candidates
    const firstNames = ['Ahmed', 'Sara', 'Hassan', 'Ayesha', 'Usama', 'Laiba', 'Zohaib', 'Nimra', 'Rafay', 'Hiba', 'Ali', 'Fatima', 'Bilal', 'Zainab', 'Taha', 'Amina', 'Hamza', 'Sana', 'Omar', 'Hira'];
    const lastNames = ['Raza', 'Khan', 'Akhtar', 'Hussain', 'Malik', 'Sheikh', 'Farooq', 'Arif', 'Shah', 'Javed', 'Ali', 'Ahmed', 'Hassan', 'Iqbal', 'Qureshi', 'Rashid', 'Khan', 'Mirza', 'Butt', 'Abbasi'];

    for (let i = 0; i < 50; i++) {
      users.push({
        firstName: firstNames[i % firstNames.length],
        lastName: lastNames[i % lastNames.length],
        email: `candidate${i + 1}@mail.com`,
        phone: `+92321999${String(1000 + i).padStart(4, '0')}`,
        password: await bcrypt.hash('Candidate@123', 10),
        isVerified: true,
        isCandidate: true,
        isRecruiter: false,
        isInterviewer: false,
      });
    }

    const createdUsers = await User.insertMany(users);
    console.log(`✅ Created ${createdUsers.length} users (1 admin, 10 recruiters, 10 interviewers, 50 candidates)`);
    return createdUsers;
  } catch (err) {
    console.error('❌ Error seeding users:', err);
    throw err;
  }
};

// ==================== SEED RESUMES ====================
const seedResumes = async (users) => {
  try {
    await Resume.deleteMany({});
    console.log('🗑️  Cleared existing resumes');

    const candidates = users.filter(u => u.isCandidate);
    const resumes = [];

    const skillsSets = [
      ['JavaScript', 'React', 'Node.js', 'MongoDB', 'Express.js'],
      ['Python', 'Django', 'PostgreSQL', 'Docker', 'AWS'],
      ['Java', 'Spring Boot', 'MySQL', 'Microservices', 'Kubernetes'],
      ['C#', '.NET', 'SQL Server', 'Azure', 'Entity Framework'],
      ['TypeScript', 'Angular', 'NestJS', 'MySQL', 'Redis'],
      ['PHP', 'Laravel', 'MySQL', 'Vue.js', 'Redis'],
      ['Go', 'Gin', 'PostgreSQL', 'Docker', 'Kubernetes'],
      ['Ruby', 'Rails', 'PostgreSQL', 'Redis', 'Sidekiq'],
      ['Swift', 'iOS', 'Firebase', 'Core Data', 'Alamofire'],
      ['Kotlin', 'Android', 'Room', 'Retrofit', 'Firebase'],
    ];

    const industries = ['Information Technology', 'Software Development', 'Web Development', 'Mobile Development', 'Data Science', 'DevOps', 'Cloud Computing', 'Cybersecurity', 'AI/ML', 'Blockchain'];

    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i];
      resumes.push({
        title: `Professional Developer ${i + 1}`,
        summary: `Experienced developer with expertise in modern web technologies. Passionate about building scalable applications and solving complex problems. Strong background in full-stack development and agile methodologies.`,
        headline: `Full Stack Developer | MERN Stack | Node.js | React.js | MongoDB`,
        skills: skillsSets[i % skillsSets.length],
        experience: `${2 + (i % 4)} years of experience in software development working on diverse projects including e-commerce platforms, social media applications, and enterprise solutions.`,
        education: 'BSc in Computer Science from a reputable Pakistani university. Strong foundation in algorithms, data structures, and software engineering principles.',
        industry: industries[i % industries.length],
        availability: ['Immediate', 'Two weeks', 'One month', 'More than a month'][i % 4],
        company: `Tech Solutions ${i + 1} Pvt Ltd`,
        achievements: `Delivered multiple high-traffic applications serving ${1000 + i * 100} users with optimized performance and scalability.`,
        portfolio: `https://portfolio-${i + 1}.example.com`,
        userId: candidate._id,
      });
    }

    await Resume.insertMany(resumes);
    console.log(`✅ Created ${resumes.length} resumes`);
  } catch (err) {
    console.error('❌ Error seeding resumes:', err);
    throw err;
  }
};

// ==================== SEED JOBS ====================
const seedJobs = async (users) => {
  try {
    await Job.deleteMany({});
    console.log('🗑️  Cleared existing jobs');

    const recruiters = users.filter(u => u.isRecruiter);
    const jobs = [];

    const jobTitles = [
      'MERN Stack Developer', 'Frontend React Engineer', 'Backend Node.js Developer',
      'Full Stack Engineer', 'UI/UX Designer', 'DevOps Engineer', 'Cloud Architect',
      'Mobile App Developer (Flutter)', 'QA Automation Engineer', 'Data Analyst',
      'Product Manager', 'Cybersecurity Analyst', 'AI Engineer', 'ML Engineer',
      'HR Manager', 'Business Development Executive', 'Software Architect', 
      'Database Administrator', 'Network Engineer', 'System Administrator',
    ];

    const companies = [
      'OrbitSoft', 'NextBridge', 'Creative Labs', 'TekSmiths', 'CyberCloud',
      'Logicon', 'Microtech', 'AlphaCode', 'BlueFox', 'TechFlow',
      'DevCore', 'InnovateTech', 'CodeCraft', 'ByteSoft', 'DataStream',
    ];

    const locations = [
      'Karachi, Pakistan', 'Lahore, Pakistan', 'Islamabad, Pakistan', 
      'Rawalpindi, Pakistan', 'Faisalabad, Pakistan', 'Multan, Pakistan',
    ];

    const categories = ['IT', 'Engineering', 'Sales', 'Marketing', 'Finance', 'Other'];

    // Generate 100 jobs distributed among recruiters
    for (let i = 0; i < 100; i++) {
      const recruiter = recruiters[i % recruiters.length];
      const title = jobTitles[i % jobTitles.length];
      const company = companies[i % companies.length];
      const location = locations[i % locations.length];
      const category = categories[i % categories.length];
      const minSalary = 40 + (i % 30);
      const maxSalary = minSalary + 40;

      jobs.push({
        title,
        description: `We are seeking a skilled ${title} to join our dynamic team at ${company}. The ideal candidate will have strong technical skills and the ability to work in a fast-paced environment. You will be responsible for developing and maintaining high-quality software solutions.`,
        company,
        requirements: [
          `${2 + (i % 4)} years of experience in software development`,
          'Strong problem-solving and analytical skills',
          'Excellent communication and teamwork abilities',
          'Proficiency in modern development tools and technologies',
          'Experience with version control systems (Git)',
          'Ability to work independently and in a team environment',
        ],
        benefits: [
          'Market competitive salary package',
          'Health insurance coverage',
          'Professional development opportunities',
          'Flexible working hours',
          'Yearly performance bonuses',
          'Paid time off and holidays',
        ],
        salaryRange: `$${minSalary}k - $${maxSalary}k`,
        category,
        location,
        recruiterId: recruiter._id,
        isClosed: false,
      });
    }

    const createdJobs = await Job.insertMany(jobs);
    console.log(`✅ Created ${createdJobs.length} jobs`);
    return createdJobs;
  } catch (err) {
    console.error('❌ Error seeding jobs:', err);
    throw err;
  }
};

// ==================== SEED APPLICATIONS ====================
const seedApplications = async (users, jobs) => {
  try {
    await Application.deleteMany({});
    console.log('🗑️  Cleared existing applications');

    const candidates = users.filter(u => u.isCandidate);
    const applications = [];
    const applicationSet = new Set(); // Track unique jobId-candidateId pairs

    // Generate 150 applications ensuring no duplicates
    let attempts = 0;
    while (applications.length < 150 && attempts < 1000) {
      const candidate = candidates[Math.floor(Math.random() * candidates.length)];
      const job = jobs[Math.floor(Math.random() * jobs.length)];
      const key = `${job._id}-${candidate._id}`;

      if (!applicationSet.has(key)) {
        applicationSet.add(key);
        const statuses = ['applied', 'shortlisted', 'rejected', 'hired'];
        const status = statuses[Math.floor(Math.random() * statuses.length)];
        
        applications.push({
          status,
          applicationDate: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000), // Random date in last 30 days
          jobId: job._id,
          candidateId: candidate._id,
        });
      }
      attempts++;
    }

    if (applications.length < 150) {
      console.warn(`⚠️  Only generated ${applications.length} unique applications (requested 150)`);
    }

    const createdApplications = await Application.insertMany(applications);
    console.log(`✅ Created ${createdApplications.length} applications`);
    return createdApplications;
  } catch (err) {
    console.error('❌ Error seeding applications:', err);
    throw err;
  }
};

// ==================== SEED CHATROOMS & MESSAGES ====================
const seedChatRoomsAndMessages = async (users, jobs) => {
  try {
    await ChatRoom.deleteMany({});
    await Message.deleteMany({});
    console.log('🗑️  Cleared chat rooms and messages');

    const recruiters = users.filter(u => u.isRecruiter);
    const interviewers = users.filter(u => u.isInterviewer);
    const chatRooms = [];
    const messages = [];
    const chatRoomTracker = new Set();

    // Create 30 chat rooms (recruiter-interviewer-job combinations)
    for (let i = 0; i < 30; i++) {
      const recruiter = recruiters[i % recruiters.length];
      const interviewer = interviewers[i % interviewers.length];
      const job = jobs[i % jobs.length];
      const key = `${recruiter._id}-${interviewer._id}-${job._id}`;

      if (!chatRoomTracker.has(key)) {
        chatRoomTracker.add(key);
        const chatRoom = await ChatRoom.create({
          recruiterId: recruiter._id,
          interviewerId: interviewer._id,
          jobId: job._id,
        });
        chatRooms.push(chatRoom);

        // Create 2-5 messages per chat room
        const messageCount = 2 + Math.floor(Math.random() * 4);
        const messageTemplates = [
          'Hello! I would like to discuss the interview process for this position.',
          'Hi! I would be happy to help with the interview process. When would you like to schedule it?',
          'Thank you for your interest. Let me check my availability.',
          'Great! I can conduct the interview next week. What time works best for you?',
          'Perfect! I will prepare the interview questions and share them with you.',
          'The interview is scheduled. Looking forward to working with you!',
        ];

        for (let j = 0; j < messageCount; j++) {
          const sender = j % 2 === 0 ? recruiter : interviewer;
          const content = messageTemplates[j % messageTemplates.length];
          
          messages.push({
            chatRoomId: chatRoom._id,
            recruiterId: recruiter._id,
            interviewerId: interviewer._id,
            senderId: sender._id,
            content,
            isRead: j < messageCount - 1, // Last message is unread
            messageType: 'text',
          });
        }
      }
    }

    if (messages.length > 0) {
      await Message.insertMany(messages);
    }

    console.log(`✅ Created ${chatRooms.length} chat rooms with ${messages.length} messages`);
    return chatRooms;
  } catch (err) {
    console.error('❌ Error seeding chat rooms/messages:', err);
    throw err;
  }
};

// ==================== SEED INTERVIEWS ====================
const seedInterviews = async (users, jobs, applications) => {
  try {
    await Interview.deleteMany({});
    console.log('🗑️  Cleared existing interviews');

    const interviewers = users.filter(u => u.isInterviewer);
    const candidates = users.filter(u => u.isCandidate);
    const interviews = [];
    const roomIdSet = new Set();

    // Create 30 interviews (mix of scheduled and completed)
    for (let i = 0; i < 30; i++) {
      const interviewer = interviewers[i % interviewers.length];
      const application = applications[Math.floor(Math.random() * applications.length)];
      
      // Ensure candidate from application exists
      const candidate = candidates.find(c => c._id.toString() === application.candidateId.toString());
      if (!candidate) continue;

      // Generate unique roomId
      let roomId = generateUniqueRoomId();
      while (roomIdSet.has(roomId)) {
        roomId = generateUniqueRoomId();
      }
      roomIdSet.add(roomId);

      const isCompleted = i < 15; // First 15 are completed
      const scheduledTime = isCompleted 
        ? new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000) // Past date
        : new Date(Date.now() + Math.random() * 14 * 24 * 60 * 60 * 1000); // Future date

      const status = isCompleted ? 'completed' : 'scheduled';
      
      interviews.push({
        roomId,
        scheduledTime,
        interviewerId: interviewer._id,
        candidateId: candidate._id,
        jobId: application.jobId,
        applicationId: application._id,
        status,
        remarks: generateRemarks(status, `${interviewer.firstName} ${interviewer.lastName}`, `${candidate.firstName} ${candidate.lastName}`, 'Developer Position'),
        ...(isCompleted && {
          callStartedAt: new Date(scheduledTime.getTime() + 5 * 60 * 1000),
          callEndedAt: new Date(scheduledTime.getTime() + 45 * 60 * 1000),
          rating: 3.5 + Math.random() * 1.5,
          summary: 'Interview completed successfully. Candidate showed strong technical skills and good communication.',
        }),
      });
    }

    const createdInterviews = await Interview.insertMany(interviews);
    console.log(`✅ Created ${createdInterviews.length} interviews (15 scheduled, 15 completed)`);
    return createdInterviews;
  } catch (err) {
    console.error('❌ Error seeding interviews:', err);
    throw err;
  }
};

// ==================== SEED CONTRACTS, TRANSACTIONS & RATINGS ====================
const seedContractsAndRelated = async (users, jobs, chatRooms, interviews) => {
  try {
    await Contract.deleteMany({});
    await InterviewerRating.deleteMany({});
    await Transaction.deleteMany({});
    console.log('🗑️  Cleared contracts, ratings, and transactions');

    const recruiters = users.filter(u => u.isRecruiter);
    const interviewers = users.filter(u => u.isInterviewer);
    const contracts = [];
    const transactions = [];
    const ratings = [];

    // Create 20 contracts (one per chat room, up to 20)
    const contractsToCreate = Math.min(20, chatRooms.length);
    for (let i = 0; i < contractsToCreate; i++) {
      const chatRoom = chatRooms[i];
      const recruiter = recruiters.find(r => r._id.toString() === chatRoom.recruiterId.toString());
      const interviewer = interviewers.find(interviewer => interviewer._id.toString() === chatRoom.interviewerId.toString());
      const job = jobs.find(j => j._id.toString() === chatRoom.jobId.toString());

      if (!recruiter || !interviewer || !job) continue;

      const agreedPrice = 400 + Math.floor(Math.random() * 600); // $400-$1000
      const statuses = ['pending', 'active', 'completed'];
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      const paymentStatus = status === 'pending' ? 'pending' : status === 'active' ? 'paid' : 'paid';

      const contract = await Contract.create({
        agreedPrice,
        status,
        paymentStatus,
        recruiterId: recruiter._id,
        interviewerId: interviewer._id,
        jobId: job._id,
        roomId: chatRoom._id,
      });
      contracts.push(contract);

      // Create transaction for each contract
      const platformFee = Math.round(agreedPrice * 0.025 * 100) / 100;
      const netAmount = Math.round((agreedPrice - platformFee) * 100) / 100;

      transactions.push({
        amount: agreedPrice,
        status: paymentStatus === 'paid' ? 'completed' : 'pending',
        transactionDate: new Date(),
        transactionType: 'payment',
        contractId: contract._id,
        platformFee,
        netAmount,
      });

      // Create rating for completed contracts
      if (status === 'completed') {
        ratings.push({
          rating: 4.0 + Math.random() * 1.0, // 4.0 to 5.0
          feedback: 'Excellent interviewer with strong technical skills and professional communication. Highly recommended for future interviews.',
          interviewerId: interviewer._id,
          recruiterId: recruiter._id,
          jobId: job._id,
          contractId: contract._id,
        });
      }
    }

    if (transactions.length > 0) {
      await Transaction.insertMany(transactions);
    }
    if (ratings.length > 0) {
      await InterviewerRating.insertMany(ratings);
    }

    console.log(`✅ Created ${contracts.length} contracts, ${transactions.length} transactions, ${ratings.length} ratings`);
    return contracts;
  } catch (err) {
    console.error('❌ Error seeding contracts/transactions/ratings:', err);
    throw err;
  }
};

// ==================== RUN SEEDER ====================
const runSeeder = async () => {
  try {
    console.log('🌱 Starting MongoDB seeder...');
    await connectDB();

    const users = await seedUsers();
    await seedResumes(users);
    const jobs = await seedJobs(users);
    const applications = await seedApplications(users, jobs);
    const chatRooms = await seedChatRoomsAndMessages(users, jobs);
    const interviews = await seedInterviews(users, jobs, applications);
    await seedContractsAndRelated(users, jobs, chatRooms, interviews);

    console.log('\n🎉 Seeding completed successfully!');
    console.log('\n📋 Test Accounts:');
    console.log('Admin: admin@ezyjobs.com / Admin@123');
    console.log('Recruiters: usman.sheikh@orbitsoft.pk - ayesha.malik@techflow.pk / Recruiter@123');
    console.log('Interviewers: areeba.naz@interviewers.com - taimoor.ahmed@interviewers.com / Interviewer@123');
    console.log('Candidates: candidate1@mail.com - candidate50@mail.com / Candidate@123');
  } catch (err) {
    console.error('❌ Seeding failed:', err);
    throw err;
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
    process.exit(0);
  }
};

// Run if executed directly
if (require.main === module) {
  runSeeder();
}

module.exports = {
  runSeeder,
};








