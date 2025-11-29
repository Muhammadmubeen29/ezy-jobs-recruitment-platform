/**
 * Validation utilities for job form fields
 */

const convertToArray = (value) => {
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }
  if (Array.isArray(value)) {
    return value;
  }
  return [];
};

export const validateTitle = (title) => {
  if (!title || !title.trim()) {
    return 'Job title is required.';
  }
  if (title.trim().length < 2) {
    return 'Job title must be at least 2 characters.';
  }
  if (title.trim().length > 100) {
    return 'Job title must not exceed 100 characters.';
  }
  return '';
};

export const validateDescription = (description) => {
  if (!description || !description.trim()) {
    return 'Description is required.';
  }
  if (description.trim().length < 50) {
    return 'Description must be at least 50 characters.';
  }
  if (description.trim().length > 5000) {
    return 'Description must not exceed 5000 characters.';
  }
  return '';
};

export const validateCompany = (company) => {
  if (!company || !company.trim()) {
    return 'Company name is required.';
  }
  if (company.trim().length < 2) {
    return 'Company name must be at least 2 characters.';
  }
  if (company.trim().length > 100) {
    return 'Company name must not exceed 100 characters.';
  }
  return '';
};

export const validateRequirements = (requirements) => {
  if (!requirements || !requirements.trim()) {
    return 'Requirements are required.';
  }
  const requirementsArray = convertToArray(requirements);
  if (requirementsArray.length === 0) {
    return 'Please provide at least one requirement.';
  }
  if (requirementsArray.length > 20) {
    return 'Please provide no more than 20 requirements.';
  }
  const requirementsJson = JSON.stringify(requirementsArray);
  if (requirementsJson.length < 50) {
    return 'Requirements content must be at least 50 characters when formatted.';
  }
  if (requirementsJson.length > 2000) {
    return 'Requirements content must not exceed 2000 characters when formatted.';
  }
  return '';
};

export const validateBenefits = (benefits) => {
  if (!benefits || !benefits.trim()) {
    return 'Benefits are required.';
  }
  const benefitsArray = convertToArray(benefits);
  if (benefitsArray.length === 0) {
    return 'Please provide at least one benefit.';
  }
  if (benefitsArray.length > 20) {
    return 'Please provide no more than 20 benefits.';
  }
  const benefitsJson = JSON.stringify(benefitsArray);
  if (benefitsJson.length < 50) {
    return 'Benefits content must be at least 50 characters when formatted.';
  }
  if (benefitsJson.length > 2000) {
    return 'Benefits content must not exceed 2000 characters when formatted.';
  }
  return '';
};

export const validateSalaryRange = (salaryRange) => {
  if (!salaryRange || !salaryRange.trim()) {
    return 'Salary range is required.';
  }
  if (salaryRange.trim().length < 2) {
    return 'Salary range must be at least 2 characters.';
  }
  if (salaryRange.trim().length > 100) {
    return 'Salary range must not exceed 100 characters.';
  }
  
  // Check for negative numbers in salary range
  // Pattern: "$50k - $60k" or "50000 - 60000" or "$50,000-$60,000"
  const salaryPattern = /(\d+)/g;
  const numbers = salaryRange.match(salaryPattern);
  
  if (numbers) {
    for (const num of numbers) {
      const numValue = parseInt(num, 10);
      if (numValue < 0) {
        return 'Salary cannot be negative.';
      }
      if (numValue === 0) {
        return 'Salary must be greater than 0.';
      }
    }
  }
  
  // Check if the string contains negative sign before numbers
  if (/-?\s*\d+/.test(salaryRange) && salaryRange.includes('-') && !salaryRange.match(/\$\d+\s*-\s*\$\d+/)) {
    // If it's not a range format like "$50k - $60k", check for negative
    const negativeMatch = salaryRange.match(/-(\d+)/);
    if (negativeMatch && parseInt(negativeMatch[1], 10) > 0) {
      return 'Salary cannot be negative.';
    }
  }
  
  return '';
};

export const validateCategory = (category, customCategory) => {
  if (!category || !category.trim()) {
    return 'Category is required.';
  }
  if (category === 'Other') {
    if (!customCategory || !customCategory.trim()) {
      return 'Please specify a custom category.';
    }
    if (customCategory.trim().length < 2) {
      return 'Custom category must be at least 2 characters.';
    }
    if (customCategory.trim().length > 100) {
      return 'Custom category must not exceed 100 characters.';
    }
  }
  return '';
};

export const validateLocation = (location) => {
  if (!location || !location.trim()) {
    return 'Location is required.';
  }
  if (location.trim().length < 2) {
    return 'Location must be at least 2 characters.';
  }
  if (location.trim().length > 100) {
    return 'Location must not exceed 100 characters.';
  }
  return '';
};

export const validateAllFields = (formData) => {
  const errors = {
    title: validateTitle(formData.title),
    description: validateDescription(formData.description),
    company: validateCompany(formData.company),
    requirements: validateRequirements(formData.requirements),
    benefits: validateBenefits(formData.benefits),
    salaryRange: validateSalaryRange(formData.salaryRange),
    category: validateCategory(formData.category, formData.customCategory),
    location: validateLocation(formData.location),
  };

  const isValid = Object.values(errors).every((error) => error === '');
  return { errors, isValid };
};

