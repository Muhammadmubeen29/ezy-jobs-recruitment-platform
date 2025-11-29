import { useEffect, useMemo, useRef, useState } from 'react';

import pakistanCities from '../data/pakistanCities.json';

const MAX_SUGGESTIONS = 8;

const normalize = (value = '') => value.trim().toLowerCase();

export default function LocationAutoComplete({
  id = 'job-location',
  label = 'Job Location',
  placeholder = 'Start typing a Pakistani city...',
  value = '',
  onChange,
  onValidationChange,
}) {
  const [inputValue, setInputValue] = useState(value);
  const [isOpen, setIsOpen] = useState(false);
  const [matches, setMatches] = useState([]);
  const [error, setError] = useState('');
  const containerRef = useRef(null);
  const prevValueRef = useRef(value);
  const canonicalCities = useMemo(
    () =>
      pakistanCities.map((city) => ({
        label: city,
        normalized: normalize(city),
      })),
    []
  );

  // Sync inputValue with value prop when it changes externally (e.g., form reset)
  useEffect(() => {
    // Only update if value prop actually changed to avoid unnecessary re-renders
    if (value !== prevValueRef.current) {
      prevValueRef.current = value;
      setInputValue(value || '');
      if (value) {
        const normalizedValue = normalize(value);
        const exactMatch = canonicalCities.find(
          (city) => city.normalized === normalizedValue
        );
        if (!exactMatch) {
          setError('Please select a valid Pakistani city from the list.');
          onValidationChange?.('Please select a valid Pakistani city from the list.');
        } else {
          setError('');
          onValidationChange?.('');
        }
      } else {
        setError('');
        onValidationChange?.('');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]); // Only depend on value - onValidationChange is stable or doesn't need to trigger re-sync

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const findMatches = (query) => {
    const normalizedQuery = normalize(query);

    if (!normalizedQuery) {
      setMatches([]);
      setIsOpen(false);
      return;
    }

    const filtered = canonicalCities
      .filter((city) => city.normalized.includes(normalizedQuery))
      .slice(0, MAX_SUGGESTIONS);

    setMatches(filtered);
    setIsOpen(true);
  };

  const validateInput = (input) => {
    if (!input || !input.trim()) {
      setError('Location is required.');
      onValidationChange?.('Location is required.');
      return false;
    }

    const normalizedValue = normalize(input);
    const exactMatch = canonicalCities.find(
      (city) => city.normalized === normalizedValue
    );

    if (!exactMatch) {
      // Check if any city starts with the input (partial match while typing)
      const startsWithMatch = canonicalCities.find((city) =>
        city.normalized.startsWith(normalizedValue)
      );
      if (!startsWithMatch) {
        setError('Please select a valid Pakistani city from the list.');
        onValidationChange?.('Please select a valid Pakistani city from the list.');
        return false;
      }
    }

    setError('');
    onValidationChange?.('');
    return true;
  };

  const handleInputChange = (event) => {
    const { value: nextValue } = event.target;
    // ALWAYS allow typing - update input value immediately
    setInputValue(nextValue);
    
    // Show suggestions as user types
    findMatches(nextValue);

    // DO NOT update parent onChange while typing
    // DO NOT validate while typing
    // DO NOT clear or set errors while typing
    // Only update parent and validate on blur or selection
  };

  const handleSelect = (city) => {
    setInputValue(city.label);
    onChange?.(city.label);
    setError('');
    onValidationChange?.('');
    setIsOpen(false);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && matches.length > 0) {
      event.preventDefault();
      handleSelect(matches[0]);
    } else if (event.key === 'Enter' && matches.length === 0 && inputValue.trim()) {
      event.preventDefault();
      validateInput(inputValue);
    }
  };

  const handleBlur = () => {
    // Validate ONLY on blur - allow free typing until then
    const normalizedValue = normalize(inputValue);
    const exactMatch = canonicalCities.find(
      (city) => city.normalized === normalizedValue
    );

    if (!inputValue || !inputValue.trim()) {
      setError('Location is required.');
      onValidationChange?.('Location is required.');
      onChange?.('');
    } else if (!exactMatch) {
      // Invalid city - show error but don't clear input
      setError('Please select a valid Pakistani city from the list.');
      onValidationChange?.('Please select a valid Pakistani city from the list.');
      onChange?.(''); // Clear parent value so form submission is blocked
    } else {
      // Valid city - update parent with exact match
      onChange?.(exactMatch.label);
      setError('');
      onValidationChange?.('');
    }
  };

  return (
    <div className="relative mb-6 w-full" ref={containerRef}>
      <label
        htmlFor={id}
        className="mb-1 block text-sm font-medium text-light-text dark:text-dark-text"
      >
        {label}
      </label>
      <input
        id={id}
        type="text"
        placeholder={placeholder}
        value={inputValue}
        onChange={handleInputChange}
        onBlur={handleBlur}
        onFocus={() => {
          if (inputValue.trim()) {
            findMatches(inputValue);
          }
        }}
        onKeyDown={handleKeyDown}
        className={`w-full rounded-lg border bg-light-background p-4 pt-6 text-light-text transition focus:outline-none focus:ring-2 dark:bg-dark-background dark:text-dark-text ${
          error
            ? 'border-red-500 focus:ring-red-500 dark:border-red-500'
            : 'border-light-border focus:ring-light-primary dark:border-dark-border dark:focus:ring-dark-primary'
        }`}
        autoComplete="off"
        aria-invalid={error ? 'true' : 'false'}
        aria-describedby={error ? `${id}-error` : undefined}
      />
      <label
        htmlFor={id}
        className="absolute left-4 top-2 text-xs font-medium text-light-text/70 dark:text-dark-text/70"
      >
        {label}
      </label>

      {error && (
        <p
          id={`${id}-error`}
          className="mt-1 text-sm text-red-600 dark:text-red-400"
        >
          {error}
        </p>
      )}

      <ul
        className={`absolute z-50 mt-1 max-h-48 w-full overflow-auto rounded-md border border-light-border bg-white shadow-lg dark:border-dark-border dark:bg-dark-surface ${
          isOpen && matches.length > 0 ? 'block' : 'hidden'
        }`}
      >
        {matches.map((city) => (
          <li
            key={city.label}
            role="option"
            tabIndex={0}
            className="cursor-pointer px-4 py-2 text-sm text-light-text hover:bg-gray-100 focus:bg-gray-100 dark:text-dark-text dark:hover:bg-gray-700 dark:focus:bg-gray-700"
            onClick={() => handleSelect(city)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                handleSelect(city);
              }
            }}
          >
            {city.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

