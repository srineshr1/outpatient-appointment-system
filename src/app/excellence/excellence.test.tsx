import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ExcellencePage, { metadata } from "./page";
import { ExcellenceTabs } from "@/components/excellence/ExcellenceTabs";
import { ExcellenceFaq } from "@/components/excellence/ExcellenceFaq";

describe("ExcellencePage Metadata", () => {
  it("exports the required metadata title and description", () => {
    expect(metadata.title).toBe(
      "Centers of Clinical Excellence & Specialized Surgery · Westbrook Medical Practice"
    );
    expect(metadata.description).toBe(
      "Pioneering surgical innovation, da Vinci Xi robotics, minimally invasive cardiac care, and world-class specialty institutes."
    );
  });
});

describe("ExcellencePage Content & Sections", () => {
  it("renders the hero section with high-impact headline, Top 1% badge, and stats strip", () => {
    render(<ExcellencePage />);

    // Top 1% badge
    expect(screen.getByText(/Top 1% Global Surgical Outcomes/i)).toBeInTheDocument();

    // High impact headline
    expect(screen.getByRole("heading", { level: 1, name: /Surgical Precision/i })).toBeInTheDocument();
    expect(screen.getByText(/Uncompromising Clinical Excellence/i)).toBeInTheDocument();

    // Stats strip
    expect(screen.getByText("99.4%")).toBeInTheDocument();
    expect(screen.getByText(/Procedural Success Rate/i)).toBeInTheDocument();

    expect(screen.getByText("12,000+")).toBeInTheDocument();
    expect(screen.getByText(/Robotic Procedures/i)).toBeInTheDocument();

    expect(screen.getByText("40%")).toBeInTheDocument();
    expect(screen.getAllByText(/Faster Recovery Times/i).length).toBeGreaterThan(0);

    expect(screen.getByText("0%")).toBeInTheDocument();
    expect(screen.getAllByText(/Infection Rate/i).length).toBeGreaterThan(0);
  });

  it("renders the 5 Centers of Excellence", () => {
    render(<ExcellencePage />);

    expect(screen.getAllByText(/da Vinci Xi Robotic & Micro-Surgical Suite/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Cardiovascular & Thoracic Institute/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Orthopedic & Joint Reconstruction Institute/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Neuro-Spine & Advanced Cerebrovascular Center/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Women's & Maternal Health Institute/i).length).toBeGreaterThan(0);
  });

  it("renders the surgical team & faculty credentials showcase", () => {
    render(<ExcellencePage />);

    expect(screen.getByText(/Trained at the Apex of Global Medicine/i)).toBeInTheDocument();

    // Fellowships
    expect(screen.getByText("Johns Hopkins Medicine")).toBeInTheDocument();
    expect(screen.getByText("University of Oxford")).toBeInTheDocument();
    expect(screen.getByText("Mayo Clinic")).toBeInTheDocument();
    expect(screen.getByText("Harvard Medical School")).toBeInTheDocument();

    // Publications
    expect(screen.getByText(/250\+ Peer-Reviewed Surgical Techniques/i)).toBeInTheDocument();
    expect(screen.getAllByText(/The Lancet/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/NEJM/i).length).toBeGreaterThan(0);

    // Faculty members
    expect(screen.getAllByText(/Prof\. Alistair Montgomery/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Dr\. Sophia Vance/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Dr\. Marcus Thorne/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Dr\. Elena Rostova/i).length).toBeGreaterThan(0);
  });

  it("renders patient success stories / case highlights", () => {
    render(<ExcellencePage />);

    expect(screen.getByText(/Complex Cases\. Unrivaled Recoveries\./i)).toBeInTheDocument();
    expect(screen.getByText(/Robotic Double-Valve Repair Without Sternal Division/i)).toBeInTheDocument();
    expect(screen.getByText(/3D-Printed Custom Titanium Acetabular Cage/i)).toBeInTheDocument();
    expect(screen.getByText(/Endoscopic Skull Base Resection with 100% Visual Restoration/i)).toBeInTheDocument();
    expect(screen.getByText(/Fetoscopic Endoluminal Tracheal Occlusion/i)).toBeInTheDocument();
  });

  it("renders booking CTAs linking to /book and #doctors", () => {
    render(<ExcellencePage />);

    const bookLinks = screen.getAllByRole("link", { name: /Book|Schedule/i });
    expect(bookLinks.some((link) => link.getAttribute("href") === "/book")).toBe(true);

    const doctorsLinks = screen.getAllByRole("link", { name: /Faculty|Doctors/i });
    expect(doctorsLinks.some((link) => link.getAttribute("href") === "#doctors")).toBe(true);
  });
});

describe("ExcellenceTabs Component", () => {
  it("allows switching between institutes interactively", () => {
    render(<ExcellenceTabs />);

    // Initially da Vinci Xi is selected
    expect(screen.getByRole("tabpanel")).toHaveTextContent(/Scotland’s highest-volume dual-console da Vinci Xi/i);

    // Click Cardiovascular tab
    const cardioTab = screen.getByRole("tab", { name: /Cardiovascular & Thoracic Institute/i });
    fireEvent.click(cardioTab);
    expect(screen.getByRole("tabpanel")).toHaveTextContent(/Transcatheter Aortic Valve Replacement \(TAVR\)/i);
    expect(screen.getByRole("tabpanel")).toHaveTextContent(/Zero-Contrast PCI/i);

    // Click Orthopedic tab
    const orthoTab = screen.getByRole("tab", { name: /Orthopedic & Joint Reconstruction Institute/i });
    fireEvent.click(orthoTab);
    expect(screen.getByRole("tabpanel")).toHaveTextContent(/Custom 3D-Printed Titanium Implants/i);
    expect(screen.getByRole("tabpanel")).toHaveTextContent(/MAKO Robotic Knee & Hip Replacement/i);

    // Click Neuro-Spine tab
    const neuroTab = screen.getByRole("tab", { name: /Neuro-Spine & Advanced Cerebrovascular Center/i });
    fireEvent.click(neuroTab);
    expect(screen.getByRole("tabpanel")).toHaveTextContent(/Endoscopic Skull Base Surgery/i);
    expect(screen.getByRole("tabpanel")).toHaveTextContent(/Intraoperative Neuromonitoring/i);

    // Click Women's Health tab
    const womensTab = screen.getByRole("tab", { name: /Women's & Maternal Health Institute/i });
    fireEvent.click(womensTab);
    expect(screen.getByRole("tabpanel")).toHaveTextContent(/High-Risk Fetal-Maternal Medicine/i);
    expect(screen.getByRole("tabpanel")).toHaveTextContent(/Deep Endometriosis Excision/i);
  });
});

describe("ExcellenceFaq Component", () => {
  it("renders questions and handles toggle", () => {
    render(<ExcellenceFaq />);

    const firstQuestion = screen.getByText(/Can patients schedule specialized surgical consultations directly/i);
    expect(firstQuestion).toBeInTheDocument();

    // Search filter
    const searchInput = screen.getByRole("searchbox", { name: /Search surgical FAQ questions/i });
    fireEvent.change(searchInput, { target: { value: "infection" } });

    expect(screen.getByText(/0% hospital-acquired infection rate/i)).toBeInTheDocument();
  });
});
