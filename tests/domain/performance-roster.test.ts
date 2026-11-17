import { describe, it, expect } from "vitest";
import { classify, mentorTrack } from "@/domain/performance/roster";

// Designations are real ones from People's HACA directory.
describe("mentorTrack", () => {
  it.each([
    ["Python Mentor", "TECH"],
    ["Data Analytics Mentor", "TECH"],
    ["Data Analytics Mentor Freelance", "TECH"],
    ["Mern Stack Mentor cum Developer", "TECH"],
    ["Web Mentor", "TECH"],
    ["GenAI Engineer & AI Agent Development Mentor", "TECH"],
    ["Web Developer & SEO Mentor", "TECH"],
    ["Graphic Designer -Mentor", "DESIGN"],
    ["UIUX Designer and Mentor", "DESIGN"],
    ["UI UX Designing Mentor", "DESIGN"],
    ["Brand Designer – Mentor", "DESIGN"],
    ["Motion Designer & Mentor", "DESIGN"],
    ["Google Ads and SEO Mentor", "MARKETING"],
    ["Performance Marketer & Mentor", "MARKETING"],
    ["Social Media & Content Creation Mentor", "MARKETING"],
  ] as const)("%s -> %s", (designation, track) => {
    expect(mentorTrack(designation)).toBe(track);
  });

  it("ignores people who aren't mentors, and mentors it can't place", () => {
    expect(mentorTrack("Student Happiness Officer")).toBeNull();
    expect(mentorTrack("Head of Academics")).toBeNull();
    expect(mentorTrack("Yoga Mentor")).toBeNull();
  });
});

describe("classify", () => {
  it("maps the SHO team", () => {
    expect(classify("Student Happiness Officer")).toEqual({ template: "SHO" });
    expect(classify("Student Experience Manager")).toEqual({ template: "SEM" });
    expect(classify("Internship Coordinator")).toEqual({ template: "Internship Coordinator" });
  });

  it("maps a mentor to the Mentor scorecard with their track", () => {
    expect(classify("Python Mentor")).toEqual({ template: "Mentor", track: "TECH" });
  });

  it("leaves unknown roles unclassified instead of guessing (e.g. Program Leads)", () => {
    expect(classify("Program Lead, Graphic Design (Online)")).toBeNull();
    expect(classify("Python Program Lead")).toBeNull();
    expect(classify(null)).toBeNull();
  });
});
