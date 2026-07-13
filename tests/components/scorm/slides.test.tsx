/**
 * Component Tests for SCORM Slide Components
 * Tests Phase 2 React components
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { DashboardSlide } from '@/components/scorm/DashboardSlide';
import { GuidedNotesSlide } from '@/components/scorm/GuidedNotesSlide';
import { ScenarioSlide } from '@/components/scorm/ScenarioSlide';
import { MediaQuizSlide } from '@/components/scorm/MediaQuizSlide';
import { SummaryPanelSlide } from '@/components/scorm/SummaryPanelSlide';

describe('SCORM Slide Components - Component Tests', () => {
  describe('DashboardSlide', () => {
    const defaultProps = {
      moduleTitle: 'Module 1',
      topicTitle: 'Topic 1',
      content: 'This is the learning content.',
      avatarImageUrl: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABA',
      trainerName: 'Sarah Johnson',
    };

    it('should render topic title', () => {
      render(<DashboardSlide {...defaultProps} />);
      expect(screen.getByText('Topic 1')).toBeInTheDocument();
    });

    it('should display trainer name', () => {
      render(<DashboardSlide {...defaultProps} />);
      expect(screen.getByText('Sarah Johnson')).toBeInTheDocument();
    });

    it('should display learning content', () => {
      render(<DashboardSlide {...defaultProps} />);
      expect(screen.getByText('This is the learning content.')).toBeInTheDocument();
    });

    it('should render avatar image', () => {
      render(<DashboardSlide {...defaultProps} />);
      const img = screen.getByRole('img', { name: /sarah/i });
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute('src', defaultProps.avatarImageUrl);
    });

    it('should render visual image when provided', () => {
      render(
        <DashboardSlide
          {...defaultProps}
          visualImageDataUrl="data:image/png;base64,iVBORw0KGgo"
        />
      );
      const visuals = screen.getAllByRole('img');
      expect(visuals.length).toBeGreaterThan(1);
    });

    it('should display module title in gradient header', () => {
      render(<DashboardSlide {...defaultProps} />);
      expect(screen.getByText(/module 1/i)).toBeInTheDocument();
    });

    it('should have gradient styling', () => {
      const { container } = render(<DashboardSlide {...defaultProps} />);
      const gradient = container.querySelector('.bg-gradient-to-r');
      expect(gradient).toBeInTheDocument();
    });
  });

  describe('GuidedNotesSlide', () => {
    const defaultProps = {
      moduleTitle: 'Module 1',
      topicTitle: 'Topic 1',
      content: 'Guided content here.',
      topicPartIndex: 0,
      topicPartCount: 2,
    };

    it('should render topic title', () => {
      render(<GuidedNotesSlide {...defaultProps} />);
      expect(screen.getByText('Topic 1')).toBeInTheDocument();
    });

    it('should show part indicator when multi-part', () => {
      render(<GuidedNotesSlide {...defaultProps} />);
      expect(screen.getByText(/part 1 of 2/i)).toBeInTheDocument();
    });

    it('should not show part indicator for single part', () => {
      render(
        <GuidedNotesSlide
          {...defaultProps}
          topicPartCount={1}
        />
      );
      expect(screen.queryByText(/part/i)).not.toBeInTheDocument();
    });

    it('should display module title', () => {
      render(<GuidedNotesSlide {...defaultProps} />);
      expect(screen.getByText(/module 1/i)).toBeInTheDocument();
    });

    it('should render content', () => {
      render(<GuidedNotesSlide {...defaultProps} />);
      expect(screen.getByText('Guided content here.')).toBeInTheDocument();
    });

    it('should show learning focus badge on first part', () => {
      render(<GuidedNotesSlide {...defaultProps} topicPartIndex={0} />);
      expect(screen.getByText(/learning focus/i)).toBeInTheDocument();
    });

    it('should not show learning focus on non-first part', () => {
      render(<GuidedNotesSlide {...defaultProps} topicPartIndex={1} />);
      expect(screen.queryByText(/learning focus/i)).not.toBeInTheDocument();
    });
  });

  describe('ScenarioSlide', () => {
    const defaultProps = {
      moduleTitle: 'Module 1',
      questionNumber: 1,
      totalQuestions: 5,
      question: {
        question: 'What would you do in this situation?',
        options: ['Option A', 'Option B', 'Option C'],
        correct_answer: 'Option B',
        situation: 'You encounter a difficult customer.',
      },
    };

    it('should display scenario situation', () => {
      render(<ScenarioSlide {...defaultProps} />);
      expect(screen.getByText('You encounter a difficult customer.')).toBeInTheDocument();
    });

    it('should display question', () => {
      render(<ScenarioSlide {...defaultProps} />);
      expect(screen.getByText('What would you do in this situation?')).toBeInTheDocument();
    });

    it('should display all options', () => {
      render(<ScenarioSlide {...defaultProps} />);
      expect(screen.getByText('Option A')).toBeInTheDocument();
      expect(screen.getByText('Option B')).toBeInTheDocument();
      expect(screen.getByText('Option C')).toBeInTheDocument();
    });

    it('should highlight correct answer', () => {
      const { container } = render(<ScenarioSlide {...defaultProps} />);
      const correctOption = container.querySelector('.border-green-500');
      expect(correctOption).toBeInTheDocument();
    });

    it('should show question number', () => {
      render(<ScenarioSlide {...defaultProps} />);
      expect(screen.getByText(/question 1 of 5/i)).toBeInTheDocument();
    });

    it('should display rationale when provided', () => {
      render(
        <ScenarioSlide
          {...defaultProps}
          question={{
            ...defaultProps.question,
            rationale: 'This is the best approach because...',
          }}
        />
      );
      expect(screen.getByText(/this is the best approach/i)).toBeInTheDocument();
    });
  });

  describe('MediaQuizSlide', () => {
    const defaultProps = {
      moduleTitle: 'Module 1',
      questionNumber: 2,
      totalQuestions: 5,
      question: {
        question: 'What is 2+2?',
        options: ['3', '4', '5', '6'],
        correct_answer: '4',
      },
    };

    it('should display question', () => {
      render(<MediaQuizSlide {...defaultProps} />);
      expect(screen.getByText('What is 2+2?')).toBeInTheDocument();
    });

    it('should display all options with letter labels', () => {
      render(<MediaQuizSlide {...defaultProps} />);
      expect(screen.getByText(/3/)).toBeInTheDocument();
      expect(screen.getByText(/4/)).toBeInTheDocument();
      expect(screen.getByText(/5/)).toBeInTheDocument();
      expect(screen.getByText(/6/)).toBeInTheDocument();
    });

    it('should highlight correct answer', () => {
      const { container } = render(<MediaQuizSlide {...defaultProps} />);
      const correctOption = container.querySelector('.border-green-500');
      expect(correctOption).toBeInTheDocument();
    });

    it('should show question counter', () => {
      render(<MediaQuizSlide {...defaultProps} />);
      expect(screen.getByText(/question 2 of 5/i)).toBeInTheDocument();
    });

    it('should show progress bar', () => {
      const { container } = render(<MediaQuizSlide {...defaultProps} />);
      const progressFill = container.querySelector('.bg-purple-600');
      expect(progressFill).toBeInTheDocument();
    });

    it('should display rationale', () => {
      render(
        <MediaQuizSlide
          {...defaultProps}
          question={{
            ...defaultProps.question,
            rationale: 'Because 2 plus 2 equals 4',
          }}
        />
      );
      expect(screen.getByText(/because 2 plus 2/i)).toBeInTheDocument();
    });
  });

  describe('SummaryPanelSlide', () => {
    const defaultProps = {
      moduleTitle: 'Module 1',
      moduleIndex: 0,
      totalModules: 3,
      takeaways: ['Key point 1', 'Key point 2', 'Key point 3'],
      isLastModule: false,
    };

    it('should display module summary heading', () => {
      render(<SummaryPanelSlide {...defaultProps} />);
      expect(screen.getByText(/module summary/i)).toBeInTheDocument();
    });

    it('should display all takeaways', () => {
      render(<SummaryPanelSlide {...defaultProps} />);
      expect(screen.getByText('Key point 1')).toBeInTheDocument();
      expect(screen.getByText('Key point 2')).toBeInTheDocument();
      expect(screen.getByText('Key point 3')).toBeInTheDocument();
    });

    it('should show progress indicator', () => {
      render(<SummaryPanelSlide {...defaultProps} />);
      expect(screen.getByText(/module 1 of 3/i)).toBeInTheDocument();
    });

    it('should show progress bar', () => {
      const { container } = render(<SummaryPanelSlide {...defaultProps} />);
      const progressFill = container.querySelector('.bg-gradient-to-r');
      expect(progressFill).toBeInTheDocument();
    });

    it('should show next module message for non-last module', () => {
      render(<SummaryPanelSlide {...defaultProps} />);
      expect(screen.getByText(/module 2 coming up/i)).toBeInTheDocument();
    });

    it('should show completion message for last module', () => {
      render(
        <SummaryPanelSlide
          {...defaultProps}
          moduleIndex={2}
          isLastModule={true}
        />
      );
      expect(screen.getByText(/course complete/i)).toBeInTheDocument();
    });

    it('should display self-assessment checklist', () => {
      render(<SummaryPanelSlide {...defaultProps} />);
      expect(screen.getByText(/i understand the main concepts/i)).toBeInTheDocument();
    });
  });

  describe('ScormLearnerPreview', () => {
    it('should render without crashing', () => {
      const { ScormLearnerPreview } = require('@/components/scorm/ScormLearnerPreview');
      render(
        <ScormLearnerPreview
          courseTitle="Test Course"
          moduleTitle="Module 1"
          moduleIndex={0}
          totalModules={1}
          slides={[]}
        />
      );
      expect(screen.getByText('Test Course')).toBeInTheDocument();
    });

    it('should display module header', () => {
      const { ScormLearnerPreview } = require('@/components/scorm/ScormLearnerPreview');
      render(
        <ScormLearnerPreview
          courseTitle="Test Course"
          moduleTitle="Module 1"
          moduleIndex={0}
          totalModules={2}
          slides={[]}
        />
      );
      expect(screen.getByText(/module 1 of 2/i)).toBeInTheDocument();
    });
  });
});
