// Contact/enquiry page.
document.addEventListener("DOMContentLoaded", () => {
  const form = document.querySelector("#enquiryForm");
  if (form && typeof window.submitEnquiry === "function") form.addEventListener("submit", window.submitEnquiry);
});
