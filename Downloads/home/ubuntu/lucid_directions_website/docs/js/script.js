document.addEventListener("DOMContentLoaded", () => {
    const menuButton = document.getElementById("mobile-menu-button");
    const mobileMenu = document.getElementById("mobile-menu");

    if (menuButton && mobileMenu) {
        menuButton.addEventListener("click", () => {
            mobileMenu.classList.toggle("hidden");
            // Toggle ARIA attribute for accessibility
            const isExpanded = menuButton.getAttribute("aria-expanded") === "true";
            menuButton.setAttribute("aria-expanded", !isExpanded);
        });
    }
    
    // Contact form handling
    const contactForm = document.getElementById("contact-form");
    const formStatus = document.getElementById("form-status");
    
    if (contactForm) {
        contactForm.addEventListener("submit", async function(event) {
            event.preventDefault();
            
            // Show sending message
            formStatus.classList.remove("hidden", "text-green-600", "text-red-600");
            formStatus.classList.add("text-gray-600");
            formStatus.innerText = "Sending message...";
            
            try {
                const formData = new FormData(contactForm);
                // Add the email destination as a hidden field
                formData.append("_replyto", document.getElementById("email").value);
                
                const response = await fetch(contactForm.action, {
                    method: "POST",
                    body: formData,
                    headers: {
                        Accept: "application/json"
                    }
                });
                
                if (response.ok) {
                    // Success message
                    contactForm.reset();
                    formStatus.classList.remove("text-gray-600", "text-red-600");
                    formStatus.classList.add("text-green-600");
                    formStatus.innerText = "Message sent successfully! We'll get back to you soon.";
                } else {
                    // Server error
                    const data = await response.json();
                    throw new Error(data.error || "Server error, please try again later.");
                }
            } catch (error) {
                // Error message
                formStatus.classList.remove("text-gray-600", "text-green-600");
                formStatus.classList.add("text-red-600");
                formStatus.innerText = error.message || "Failed to send message. Please try again later.";
            }
        });
    }
});

