const colors = require('colors');
const mongoose = require('mongoose');

const { Application, Job, Interview, User } = require('../models');

const {
  protectSocket,
  authorizeSocketRoles,
} = require('../middlewares/auth.middleware');

const { formatResponse, generateRemarks } = require('../utils/interview.utils');

const setupVideoCallSocket = (io) => {
  console.log('\n' + '='.repeat(86).cyan);
  console.log(`🎥 VIDEO CALL SOCKET INITIALIZATION`.bold.cyan);
  console.log('='.repeat(86).cyan);
  console.log(`🚀 Setting up video call socket...`.green);

  const videoCallNamespace = io.of('/video-interviews');
  console.log(
    `🌐 Video call namespace created: ${videoCallNamespace.name}`.green
  );

  videoCallNamespace.use(protectSocket);
  videoCallNamespace.use(authorizeSocketRoles('isCandidate', 'isInterviewer'));
  console.log(`🔒 Socket authentication middleware applied`.green);

  const rooms = new Map();
  console.log(`🗄️  In-memory room storage initialized`.yellow);

  videoCallNamespace.on('connection', (socket) => {
    console.log('-'.repeat(86).green);
    console.log(
      `👤 User connected: ${socket.user.id} (${socket.user.firstName} ${socket.user.lastName})`
        .green
    );
    console.log(`🔌 Socket ID: ${socket.id}`.gray);

    socket.on('join-room', async (roomId) => {
      console.log(`🚪 Join room request received for room: ${roomId}`.cyan);

      if (!roomId || typeof roomId !== 'string' || roomId.trim() === '') {
        socket.emit('error', formatResponse(false, 'Invalid room ID provided'));
        return;
      }

      try {
        // Build query for interview
        const now = new Date();
        const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
        const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);

        const interview = await Interview.findOne({
          roomId,
          $and: [
            {
              $or: [
                { interviewerId: new mongoose.Types.ObjectId(socket.user.id) },
                { candidateId: new mongoose.Types.ObjectId(socket.user.id) },
              ],
            },
            {
              status: { $in: ['scheduled', 'ongoing'] },
            },
            {
              $or: [
                { status: 'ongoing' },
                {
                  status: 'scheduled',
                  scheduledTime: {
                    $gte: fiveMinutesAgo,
                    $lte: oneHourLater,
                  },
                },
              ],
            },
          ],
        })
          .populate('interviewerId', 'id firstName lastName email')
          .populate('candidateId', 'id firstName lastName email')
          .populate('jobId', 'id title company description')
          .populate('applicationId', 'id status');

        if (!interview) {
          console.log(`❌ Interview not found for room ID: ${roomId}`.red);
          socket.emit(
            'error',
            formatResponse(false, 'Interview room not found')
          );
          return;
        }

        // Check authorization
        const interviewerIdStr = interview.interviewerId._id 
          ? interview.interviewerId._id.toString() 
          : interview.interviewerId.toString();
        const candidateIdStr = interview.candidateId._id 
          ? interview.candidateId._id.toString() 
          : interview.candidateId.toString();
        const userIdStr = socket.user.id.toString();

        if (userIdStr !== interviewerIdStr && userIdStr !== candidateIdStr) {
          socket.emit(
            'error',
            formatResponse(
              false,
              'You are not authorized to join this interview'
            )
          );
          return;
        }

        if (!rooms.has(roomId)) {
          console.log(`🆕 Creating new room with ID: ${roomId}`.yellow);
          rooms.set(roomId, new Set());
        } else {
          console.log(
            `📊 Room ${roomId} already exists with ${rooms.get(roomId).size} participants`
              .yellow
          );
        }

        const room = rooms.get(roomId);

        if (room.size >= 2) {
          console.log(`❌ Room ${roomId} is full, rejecting join request`.red);
          socket.emit(
            'room-full',
            formatResponse(
              false,
              'This interview room is full. Maximum of 2 participants allowed.'
            )
          );
          return;
        }

        socket.join(roomId);
        console.log(`✅ Socket ${socket.id} joined room ${roomId}`.green);

        const participant = {
          id: socket.user.id,
          firstName: socket.user.firstName,
          lastName: socket.user.lastName,
          isCandidate: socket.user.isCandidate,
          isInterviewer: socket.user.isInterviewer,
          socketId: socket.id,
        };

        room.add(participant);
        console.log(
          `👤 Added user to room participants: ${JSON.stringify(participant)}`
            .yellow
        );

        if (room.size === 1 && interview.status === 'scheduled') {
          const jobTitle = interview.jobId.title || interview.jobId;
          const interviewerName = interview.interviewerId.firstName 
            ? `${interview.interviewerId.firstName} ${interview.interviewerId.lastName}`
            : 'Interviewer';
          const candidateName = interview.candidateId.firstName
            ? `${interview.candidateId.firstName} ${interview.candidateId.lastName}`
            : 'Candidate';

          await Interview.findByIdAndUpdate(
            interview._id,
            {
              callStartedAt: new Date(),
              status: 'ongoing',
              remarks: generateRemarks(
                'ongoing',
                interviewerName,
                candidateName,
                jobTitle
              ),
            },
            { new: true }
          );
          console.log(`🔄 Updated interview status to "ongoing"`.cyan);
        }

        const participants = Array.from(room);
        console.log(
          `👥 Current participants in room ${roomId}: ${participants.length}`
            .cyan
        );

        const job = interview.jobId._id ? interview.jobId : interview.jobId;
        const interviewer = interview.interviewerId._id 
          ? interview.interviewerId 
          : interview.interviewerId;
        const candidate = interview.candidateId._id 
          ? interview.candidateId 
          : interview.candidateId;

        const interviewDetails = {
          id: interview._id,
          roomId: interview.roomId,
          scheduledTime: interview.scheduledTime,
          callStartedAt: interview.callStartedAt,
          status: interview.status,
          job: {
            id: job._id || job,
            title: job.title || 'N/A',
            company: job.company || 'N/A',
          },
          interviewer: {
            id: interviewer._id || interviewer,
            name: interviewer.firstName 
              ? `${interviewer.firstName} ${interviewer.lastName}`
              : 'Interviewer',
          },
          candidate: {
            id: candidate._id || candidate,
            name: candidate.firstName
              ? `${candidate.firstName} ${candidate.lastName}`
              : 'Candidate',
          },
        };

        videoCallNamespace.to(roomId).emit(
          'participant-joined',
          formatResponse(
            true,
            `${participant.firstName} ${participant.lastName} joined the room`,
            {
              roomId,
              participant,
              participants,
              interviewDetails,
            }
          )
        );
        console.log(
          `📢 Notified room of new participant: ${participant.id}`.green
        );

        socket.emit(
          'room-joined',
          formatResponse(true, 'Successfully joined interview room', {
            roomId,
            participants,
            interviewDetails,
          })
        );
        console.log(
          `📤 Sent existing participants to new user: ${socket.user.id}`.green
        );

        console.log(
          `✅ User ${socket.user.id} joined room ${roomId} successfully`.green
            .bold
        );
      } catch (error) {
        console.error('\n' + '='.repeat(86).red);
        console.error(`❌ ERROR JOINING ROOM ${roomId}`.red.bold);
        console.error('='.repeat(86).red);
        console.error(`📌 Error Type: ${error.name || 'Unknown Error'}`.red);
        console.error(`💬 Message: ${error.message}`.red);
        console.error(`⏰ Time: ${new Date().toLocaleString()}`.red);
        console.error('='.repeat(86).red);
        socket.emit(
          'error',
          formatResponse(false, 'Failed to join room', {
            details: error.message,
          })
        );
      }
    });

    socket.on('leave-room', (roomId) => {
      console.log(`🚪 Leave room request received for room: ${roomId}`.cyan);
      leaveRoom(socket, roomId, false);
    });

    socket.on('end-call', async (roomId) => {
      console.log(
        `📞 End call request received for room: ${roomId} from user ${socket.user.id}`
          .cyan
      );

      if (!socket.user.isInterviewer) {
        socket.emit(
          'error',
          formatResponse(
            false,
            'Only interviewers can end the call for everyone'
          )
        );
        return;
      }

      try {
        const interview = await Interview.findOne({
          roomId,
          status: { $in: ['scheduled', 'ongoing'] },
          interviewerId: new mongoose.Types.ObjectId(socket.user.id),
        })
          .populate('interviewerId', 'id firstName lastName email')
          .populate('candidateId', 'id firstName lastName email')
          .populate('jobId', 'id title company description')
          .populate('applicationId', 'id status');

        if (!interview) {
          socket.emit('error', formatResponse(false, 'Interview not found'));
          return;
        }

        const jobTitle = interview.jobId.title || interview.jobId;
        const interviewerName = interview.interviewerId.firstName 
          ? `${interview.interviewerId.firstName} ${interview.interviewerId.lastName}`
          : 'Interviewer';
        const candidateName = interview.candidateId.firstName
          ? `${interview.candidateId.firstName} ${interview.candidateId.lastName}`
          : 'Candidate';

        await Interview.findByIdAndUpdate(
          interview._id,
          {
            callEndedAt: new Date(),
            status: 'completed',
            remarks: generateRemarks(
              'completed',
              interviewerName,
              candidateName,
              jobTitle
            ),
          },
          { new: true }
        );

        videoCallNamespace.to(roomId).emit(
          'call-ended',
          formatResponse(true, 'The interviewer has ended the call', {
            roomId,
          })
        );

        const room = rooms.get(roomId);
        if (room) {
          const participants = Array.from(room);
          participants.forEach((participant) => {
            const participantSocket = videoCallNamespace.sockets.get(
              participant.socketId
            );
            if (participantSocket && participantSocket.id !== socket.id) {
              leaveRoom(participantSocket, roomId, true);
            }
          });
        }

        leaveRoom(socket, roomId, true);

        console.log(
          `✅ Interview in room ${roomId} marked as completed`.green.bold
        );
      } catch (error) {
        console.error('\n' + '='.repeat(86).red);
        console.error(`❌ ERROR ENDING CALL FOR ROOM ${roomId}`.red.bold);
        console.error('='.repeat(86).red);
        console.error(`📌 Error Type: ${error.name || 'Unknown Error'}`.red);
        console.error(`💬 Message: ${error.message}`.red);
        console.error(`⏰ Time: ${new Date().toLocaleString()}`.red);
        console.error('='.repeat(86).red);
        socket.emit(
          'error',
          formatResponse(false, 'Failed to end the call', {
            details: error.message,
          })
        );
      }
    });

    socket.on('offer', ({ targetId, sdp, roomId }) => {
      console.log(
        `🔄 Offer received from ${socket.id} to ${targetId} in room ${roomId}`
          .cyan
      );

      if (!validateMessageParams({ targetId, sdp, roomId }, socket)) return;

      videoCallNamespace.to(targetId).emit(
        'offer',
        formatResponse(true, 'Received WebRTC offer', {
          sdp,
          callerId: socket.id,
          callerInfo: {
            id: socket.user.id,
            firstName: socket.user.firstName,
            lastName: socket.user.lastName,
          },
          roomId,
        })
      );
      console.log(`📤 Offer forwarded to ${targetId}`.green);
    });

    socket.on('answer', ({ targetId, sdp, roomId }) => {
      console.log(
        `🔄 Answer received from ${socket.id} to ${targetId} in room ${roomId}`
          .cyan
      );

      if (!validateMessageParams({ targetId, sdp, roomId }, socket)) return;

      videoCallNamespace.to(targetId).emit(
        'answer',
        formatResponse(true, 'Received WebRTC answer', {
          sdp,
          calleeId: socket.id,
          roomId,
        })
      );
      console.log(`📤 Answer forwarded to ${targetId}`.green);
    });

    socket.on('ice-candidate', ({ targetId, candidate, roomId }) => {
      console.log(
        `🧊 ICE candidate from ${socket.id} to ${targetId} in room ${roomId}`
          .cyan
      );

      if (!validateMessageParams({ targetId, candidate, roomId }, socket))
        return;

      videoCallNamespace.to(targetId).emit(
        'ice-candidate',
        formatResponse(true, 'Received ICE candidate', {
          candidate,
          senderId: socket.id,
          roomId,
        })
      );
      console.log(`📤 ICE candidate forwarded to ${targetId}`.green);
    });

    socket.on('toggle-video', ({ roomId, enabled }) => {
      console.log(
        `🎥 User ${socket.user.id} toggled video: ${enabled ? 'ON' : 'OFF'} in room ${roomId}`
          .yellow
      );

      if (!validateRoomId(roomId, socket)) return;
      if (typeof enabled !== 'boolean') {
        socket.emit(
          'error',
          formatResponse(false, 'Invalid enabled parameter')
        );
        return;
      }

      socket.to(roomId).emit(
        'user-toggle-video',
        formatResponse(
          true,
          `${socket.user.firstName} ${socket.user.lastName} ${enabled ? 'enabled' : 'disabled'} their video`,
          {
            userId: socket.user.id,
            enabled,
          }
        )
      );
      console.log(`📢 Video toggle event broadcasted to room ${roomId}`.green);
    });

    socket.on('toggle-audio', ({ roomId, enabled }) => {
      console.log(
        `🎤 User ${socket.user.id} toggled audio: ${enabled ? 'ON' : 'OFF'} in room ${roomId}`
          .yellow
      );

      if (!validateRoomId(roomId, socket)) return;
      if (typeof enabled !== 'boolean') {
        socket.emit(
          'error',
          formatResponse(false, 'Invalid enabled parameter')
        );
        return;
      }

      socket.to(roomId).emit(
        'user-toggle-audio',
        formatResponse(
          true,
          `${socket.user.firstName} ${socket.user.lastName} ${enabled ? 'enabled' : 'disabled'} their audio`,
          {
            userId: socket.user.id,
            enabled,
          }
        )
      );
      console.log(`📢 Audio toggle event broadcasted to room ${roomId}`.green);
    });

    socket.on('disconnect', () => {
      console.log('-'.repeat(86).red);
      console.log(
        `👋 User disconnected: ${socket.user.id} (Socket ID: ${socket.id})`.red
      );

      for (const [roomId, participants] of rooms.entries()) {
        console.log(`🔍 Checking if user was in room ${roomId}`.yellow);
        const participantArray = Array.from(participants);
        const userParticipant = participantArray.find(
          (p) => p.socketId === socket.id
        );

        if (userParticipant) {
          console.log(`✅ Found user in room ${roomId}, cleaning up`.cyan);
          leaveRoom(socket, roomId, false);

          if (userParticipant.isInterviewer) {
            handleInterviewerDisconnect(socket, roomId);
          }
        }
      }
      console.log(
        `✅ Disconnect cleanup completed for user ${socket.user.id}`.green
      );
    });

    function validateMessageParams(params, socket) {
      const { targetId, roomId } = params;

      if (!targetId || typeof targetId !== 'string') {
        socket.emit('error', formatResponse(false, 'Invalid target ID'));
        return false;
      }

      return validateRoomId(roomId, socket);
    }

    function validateRoomId(roomId, socket) {
      if (!roomId || typeof roomId !== 'string') {
        socket.emit('error', formatResponse(false, 'Invalid room ID'));
        return false;
      }

      const room = rooms.get(roomId);
      if (!room) {
        socket.emit('error', formatResponse(false, 'Room does not exist'));
        return false;
      }

      const participants = Array.from(room);
      const isParticipant = participants.some((p) => p.socketId === socket.id);

      if (!isParticipant) {
        socket.emit(
          'error',
          formatResponse(false, 'You are not a participant in this room')
        );
        return false;
      }

      return true;
    }

    async function handleInterviewerDisconnect(socket, roomId) {
      try {
        const room = rooms.get(roomId);
        if (!room) return;

        const participants = Array.from(room);

        participants.forEach((participant) => {
          if (participant.socketId !== socket.id) {
            const participantSocket = videoCallNamespace.sockets.get(
              participant.socketId
            );
            if (participantSocket) {
              participantSocket.emit(
                'interviewer-disconnected',
                formatResponse(
                  true,
                  'The interviewer has disconnected from the call',
                  { roomId }
                )
              );
            }
          }
        });

        const interview = await Interview.findOne({ roomId })
          .populate('interviewerId', 'id firstName lastName email')
          .populate('candidateId', 'id firstName lastName email')
          .populate('jobId', 'id title company description')
          .populate('applicationId', 'id status');

        if (interview && interview.status === 'ongoing') {
          const jobTitle = interview.jobId.title || interview.jobId;
          const interviewerName = interview.interviewerId.firstName 
            ? `${interview.interviewerId.firstName} ${interview.interviewerId.lastName}`
            : 'Interviewer';
          const candidateName = interview.candidateId.firstName
            ? `${interview.candidateId.firstName} ${interview.candidateId.lastName}`
            : 'Candidate';

          await Interview.findByIdAndUpdate(
            interview._id,
            {
              callEndedAt: new Date(),
              status: 'completed',
              remarks: generateRemarks(
                'completed',
                interviewerName,
                candidateName,
                jobTitle
              ),
            },
            { new: true }
          );
          console.log(
            `⚠️ Interview in room ${roomId} marked as completed due to interviewer disconnect`
              .yellow.bold
          );
        }
      } catch (error) {
        console.error('\n' + '='.repeat(86).red);
        console.error(`❌ ERROR HANDLING INTERVIEWER DISCONNECT`.red.bold);
        console.error('='.repeat(86).red);
        console.error(`📌 Error Type: ${error.name || 'Unknown Error'}`.red);
        console.error(`💬 Message: ${error.message}`.red);
        console.error(`🔑 Room ID: ${roomId}`.red);
        console.error(`⏰ Time: ${new Date().toLocaleString()}`.red);
        console.error('='.repeat(86).red);
      }
    }

    async function leaveRoom(socket, roomId, isCallEnded = false) {
      console.log(
        `🚪 Processing room leave for user ${socket.user.id} from room ${roomId}`
          .yellow
      );
      try {
        if (!rooms.has(roomId)) {
          console.log(`❌ Room ${roomId} not found, nothing to leave`.red);
          return;
        }

        const room = rooms.get(roomId);
        console.log(
          `📊 Room ${roomId} has ${room.size} participants before leaving`.cyan
        );

        const participantArray = Array.from(room);
        const participant = participantArray.find(
          (p) => p.socketId === socket.id
        );

        if (participant) {
          console.log(
            `🔍 Found participant to remove: ${JSON.stringify(participant)}`
              .yellow
          );
          room.delete(participant);

          socket.leave(roomId);
          console.log(`🚪 Socket ${socket.id} left room ${roomId}`.green);

          socket.to(roomId).emit(
            'participant-left',
            formatResponse(
              true,
              `${participant.firstName} ${participant.lastName} left the room`,
              {
                roomId,
                participantId: socket.user.id,
              }
            )
          );
          console.log(
            `📢 Notified others about participant leaving room ${roomId}`.green
          );

          console.log(
            `✅ User ${socket.user.id} left room ${roomId}`.green.bold
          );

          if (room.size === 0) {
            try {
              const interview = await Interview.findOne({ roomId })
                .populate('interviewerId', 'id firstName lastName email')
                .populate('candidateId', 'id firstName lastName email')
                .populate('jobId', 'id title company description')
                .populate('applicationId', 'id status');

              if (interview && interview.status === 'ongoing' && !isCallEnded) {
                const jobTitle = interview.jobId.title || interview.jobId;
                const interviewerName = interview.interviewerId.firstName 
                  ? `${interview.interviewerId.firstName} ${interview.interviewerId.lastName}`
                  : 'Interviewer';
                const candidateName = interview.candidateId.firstName
                  ? `${interview.candidateId.firstName} ${interview.candidateId.lastName}`
                  : 'Candidate';

                await Interview.findByIdAndUpdate(
                  interview._id,
                  {
                    callEndedAt: new Date(),
                    status: 'completed',
                    remarks: generateRemarks(
                      'completed',
                      interviewerName,
                      candidateName,
                      jobTitle
                    ),
                  },
                  { new: true }
                );
                console.log(
                  `✅ Interview in room ${roomId} marked as completed (all participants left)`
                    .cyan.bold
                );
              }
            } catch (dbError) {
              console.error('\n' + '='.repeat(86).red);
              console.error(`❌ ERROR UPDATING INTERVIEW STATUS`.red.bold);
              console.error('='.repeat(86).red);
              console.error(
                `📌 Error Type: ${dbError.name || 'Unknown Error'}`.red
              );
              console.error(`💬 Message: ${dbError.message}`.red);
              console.error(`🔑 Room ID: ${roomId}`.red);
              console.error(`⏰ Time: ${new Date().toLocaleString()}`.red);
              console.error('='.repeat(86).red);
            }

            rooms.delete(roomId);
            console.log(`🗑️ Room ${roomId} deleted (empty)`.red.bold);
          } else {
            console.log(
              `📊 Room ${roomId} still has ${room.size} participants`.yellow
            );
          }
        } else {
          console.log(
            `❓ Participant with socket ID ${socket.id} not found in room ${roomId}`
              .red
          );
        }
      } catch (error) {
        console.error('\n' + '='.repeat(86).red);
        console.error(`❌ ERROR LEAVING ROOM`.red.bold);
        console.error('='.repeat(86).red);
        console.error(`📌 Error Type: ${error.name || 'Unknown Error'}`.red);
        console.error(`💬 Message: ${error.message}`.red);
        console.error(`🔑 Room ID: ${roomId}`.red);
        console.error(`👤 User ID: ${socket.user.id}`.red);
        console.error(`⏰ Time: ${new Date().toLocaleString()}`.red);
        console.error('='.repeat(86).red);
        socket.emit(
          'error',
          formatResponse(false, 'Error leaving room', {
            details: error.message,
          })
        );
      }
    }
  });

  console.log('-'.repeat(86).cyan);
  console.log(`✅ Video call socket setup complete`.green.bold);
  console.log('='.repeat(86).cyan);
};

module.exports = setupVideoCallSocket;
