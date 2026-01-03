import { createApi } from '@reduxjs/toolkit/query/react';

import axiosBaseQueryWithReauth from '../../api/axiosBaseQueryWithReauth';

const ENDPOINTS = {
  ASSESSMENTS: '/pre-assessments',
  ASSESSMENT_DETAIL: (id) => `/pre-assessments/${id}`,
  ASSESSMENT_START: (id) => `/pre-assessments/${id}/start`,
  ASSESSMENT_SUBMIT: (id) => `/pre-assessments/${id}/submit`,
  ASSESSMENT_INTEGRITY: (id) => `/pre-assessments/${id}/integrity`,
  ASSESSMENT_RESULTS: (id) => `/pre-assessments/${id}/results`,
  ASSESSMENTS_BY_CANDIDATE: (candidateId) => `/pre-assessments/candidate/${candidateId}`,
};

export const assessmentApi = createApi({
  reducerPath: 'assessmentApi',
  baseQuery: axiosBaseQueryWithReauth,
  tagTypes: ['Assessments'],
  endpoints: (builder) => ({
    getAssessmentById: builder.query({
      query: (id) => ({
        url: ENDPOINTS.ASSESSMENT_DETAIL(id),
        method: 'GET',
      }),
      providesTags: (result, error, id) => [{ type: 'Assessments', id }],
    }),
    getAssessmentsByCandidate: builder.query({
      query: (candidateId) => ({
        url: ENDPOINTS.ASSESSMENTS_BY_CANDIDATE(candidateId),
        method: 'GET',
      }),
      providesTags: ['Assessments'],
    }),
    startAssessment: builder.mutation({
      query: (id) => ({
        url: ENDPOINTS.ASSESSMENT_START(id),
        method: 'POST',
      }),
      invalidatesTags: (result, error, id) => [{ type: 'Assessments', id }],
    }),
    submitAssessment: builder.mutation({
      query: ({ id, answers, integrity }) => ({
        url: ENDPOINTS.ASSESSMENT_SUBMIT(id),
        method: 'POST',
        data: { answers, integrity },
      }),
      invalidatesTags: (result, error, id) => [{ type: 'Assessments', id }],
    }),
    logIntegrityViolation: builder.mutation({
      query: ({ id, type, violationType }) => ({
        url: ENDPOINTS.ASSESSMENT_INTEGRITY(id),
        method: 'POST',
        data: { type, violationType },
      }),
    }),
    getAssessmentResults: builder.query({
      query: (id) => ({
        url: ENDPOINTS.ASSESSMENT_RESULTS(id),
        method: 'GET',
      }),
      providesTags: (result, error, id) => [{ type: 'Assessments', id }],
    }),
    createPreAssessment: builder.mutation({
      query: ({ applicationId, timeLimit }) => ({
        url: ENDPOINTS.ASSESSMENTS,
        method: 'POST',
        data: { applicationId, timeLimit },
      }),
      invalidatesTags: ['Assessments'],
    }),
  }),
});

export const {
  useGetAssessmentByIdQuery,
  useGetAssessmentsByCandidateQuery,
  useStartAssessmentMutation,
  useSubmitAssessmentMutation,
  useLogIntegrityViolationMutation,
  useGetAssessmentResultsQuery,
  useCreatePreAssessmentMutation,
} = assessmentApi;

