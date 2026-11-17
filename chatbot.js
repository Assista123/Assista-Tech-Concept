document.addEventListener('DOMContentLoaded', () => {
  const launcher = document.getElementById('assista-launcher');
  const chat = document.getElementById('assista-chat');
  const closeBtn = document.getElementById('assista-close');
  
  // Guard against missing elements
  if (!chat || !launcher) return; 

  const chatBody = document.getElementById('assista-chat-body');
  const inputArea = document.getElementById('assista-input-area');
  const textInput = document.getElementById('assista-text-input');
  const sendBtn = document.getElementById('assista-send-btn');

  const FORMSPREE_ENDPOINT = 'https://formspree.io/f/mjywywqw';
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  let userHasInteracted = false;
  let editing = false;
  let chatInitialized = false; // Prevents restarting the flow when reopening

  // --- TOGGLE LOGIC ---
  function openChat() {
    chat.classList.add('is-open');
    launcher.setAttribute('aria-expanded', 'true');
    
    if (!chatInitialized) {
      renderStep('start');
      chatInitialized = true;
    } else {
      // Focus the input if returning to the chat
      if (!inputArea.classList.contains('is-hidden')) {
        textInput.focus({ preventScroll: true });
      }
    }
  }

  function closeChat() {
    chat.classList.remove('is-open');
    launcher.setAttribute('aria-expanded', 'false');
    launcher.focus({ preventScroll: true }); // Return focus to launcher
  }

  launcher.addEventListener('click', () => {
    if (chat.classList.contains('is-open')) {
      closeChat();
    } else {
      openChat();
    }
  });

  closeBtn.addEventListener('click', closeChat);

  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && chat.classList.contains('is-open')) {
      closeChat();
    }
  });

  // --- FLOW LOGIC (Unchanged from previous version) ---
  const flow = {
    start: {
      prompt: "Hi, I'm the Assista assistant. Tell me what's slow, manual or incomplete in your work and I'll pass it to the team.\n\nWhat kind of friction is it?",
      options: ["Enquiries", "Payments", "Daily records", "Something else", "Not sure"],
      next: (answer) => {
        if (answer === "Enquiries") return "enquiries_followup";
        if (answer === "Payments") return "payments_followup";
        if (answer === "Daily records") return "records_followup";
        return "description"; 
      }
    },
    enquiries_followup: {
      prompt: "Who handles these enquiries today?",
      options: ["Owner", "Team member", "No one specifically", "Not sure"],
      next: "description"
    },
    payments_followup: {
      prompt: "How are payments tracked today?",
      options: ["Manual notes", "Spreadsheet", "Software", "Not sure"],
      next: "description"
    },
    records_followup: {
      prompt: "How do you keep daily records today?",
      options: ["Paper/Notebook", "Spreadsheet", "Memory", "Not sure"],
      next: "description"
    },
    description: {
      prompt: "Describe the problem in a sentence or two.",
      type: "text",
      placeholder: "e.g., We lose track of customer orders on WhatsApp...",
      next: "name"
    },
    name: {
      prompt: "What's your name?",
      type: "text",
      placeholder: "Your name",
      next: "contact"
    },
    contact: {
      prompt: "What's the best email or phone number to reach you?",
      type: "text",
      placeholder: "Email or phone",
      next: "summary"
    },
    summary: {
      type: "summary"
    },
    success: {
      type: "success"
    }
  };

  let state = {
    currentStep: 'start',
    data: {
      friction: '',
      followup: '',
      description: '',
      name: '',
      contact: ''
    }
  };

  function scrollToBottom() {
    chatBody.scrollTop = chatBody.scrollHeight;
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function isValidContact(v) {
    const digits = v.replace(/\D/g, '');
    return EMAIL_RE.test(v) || (digits.length >= 10 && digits.length <= 15);
  }

  function addMessage(text, sender = 'bot', html = false) {
    const bubble = document.createElement('div');
    bubble.className = `assista-bubble ${sender}`;
    if (html) {
      bubble.innerHTML = text;
    } else {
      bubble.textContent = text;
      bubble.classList.add('is-text');
    }
    chatBody.appendChild(bubble);
    scrollToBottom();
  }

  function addOptions(options, callback) {
    const optionsContainer = document.createElement('div');
    optionsContainer.className = 'assista-options';
    
    options.forEach(opt => {
      const btn = document.createElement('button');
      btn.className = 'assista-option-btn';
      btn.textContent = opt;
      btn.onclick = () => {
        userHasInteracted = true;
        optionsContainer.remove();
        callback(opt);
      };
      optionsContainer.appendChild(btn);
    });
    
    chatBody.appendChild(optionsContainer);
    scrollToBottom();
    
    const firstBtn = optionsContainer.querySelector('button');
    if (userHasInteracted && firstBtn) firstBtn.focus({ preventScroll: true });
  }

  function showTextInput(placeholder) {
    inputArea.classList.remove('is-hidden');
    textInput.placeholder = placeholder || "Type your answer...";
    textInput.value = '';
    if (userHasInteracted) textInput.focus({ preventScroll: true });
  }

  function hideTextInput() {
    inputArea.classList.add('is-hidden');
  }

  function renderStep(stepId) {
    const step = flow[stepId];
    state.currentStep = stepId;

    if (step.type === 'text') {
      if (step.prompt) addMessage(step.prompt);
      showTextInput(step.placeholder);
    } 
    else if (step.type === 'summary') {
      hideTextInput();
      showSummary();
    }
    else if (step.type === 'success') {
      hideTextInput();
      showSuccess();
    }
    else {
      hideTextInput();
      addMessage(step.prompt);
      addOptions(step.options, (answer) => {
        addMessage(answer, 'user');
        if (stepId === 'start') state.data.friction = answer;
        if (stepId.includes('followup')) state.data.followup = answer;
        
        const nextStep = typeof step.next === 'function' ? step.next(answer) : step.next;
        renderStep(nextStep);
      });
    }
  }

  function handleTextSubmit() {
    const val = textInput.value.trim();
    if (!val) return;
    userHasInteracted = true;

    if (state.currentStep === 'contact' && !isValidContact(val)) {
      addMessage(val, 'user');
      addMessage("That doesn't look like an email address or phone number. Could you check it?");
      textInput.value = '';
      textInput.focus({ preventScroll: true });
      return;
    }

    hideTextInput();
    addMessage(val, 'user');
    
    if (state.currentStep === 'description') state.data.description = val;
    if (state.currentStep === 'name') state.data.name = val;
    if (state.currentStep === 'contact') state.data.contact = val;

    const nextStep = editing ? 'summary' : flow[state.currentStep].next;
    editing = false;
    renderStep(nextStep);
  }

  sendBtn.addEventListener('click', handleTextSubmit);
  textInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleTextSubmit();
  });

  function showSummary() {
    const summaryText = `
      <strong>Here's a summary:</strong><br><br>
      <strong>Friction:</strong> ${escapeHtml(state.data.friction)}<br>
      ${state.data.followup ? `<strong>Current handling:</strong> ${escapeHtml(state.data.followup)}<br>` : ''}
      <strong>Details:</strong> ${escapeHtml(state.data.description)}<br>
      <strong>Name:</strong> ${escapeHtml(state.data.name)}<br>
      <strong>Contact:</strong> ${escapeHtml(state.data.contact)}<br><br>
      <span class="assista-note">By sending this, you agree to be contacted about your enquiry.</span><br><br>
      Ready to send?
    `;
    addMessage(summaryText, 'bot', true);
    
    addOptions(["Send", "Edit details"], (choice) => {
      addMessage(choice, 'user');
      if (choice === "Send") {
        submitToFormspree();
      } else {
        addMessage("What would you like to edit?");
        addOptions(["Problem description", "Name", "Contact info"], (editChoice) => {
          addMessage(editChoice, 'user');
          editing = true;
          if (editChoice === "Problem description") renderStep('description');
          if (editChoice === "Name") renderStep('name');
          if (editChoice === "Contact info") renderStep('contact');
        });
      }
    });
  }

  async function submitToFormspree() {
    addMessage("Sending...", 'system');
    
    const payload = {
      _subject: "New chat enquiry from Assista Tech Concept site",
      FrictionType: state.data.friction,
      CurrentHandling: state.data.followup || "N/A",
      ProblemDescription: state.data.description,
      Name: state.data.name,
      ContactDetails: state.data.contact,
      ...(EMAIL_RE.test(state.data.contact) ? { email: state.data.contact } : {})
    };

    try {
      const response = await fetch(FORMSPREE_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        renderStep('success');
      } else {
        showError("There was a problem sending your message.");
      }
    } catch (error) {
      showError("Network error.");
    }
  }

  function showError(prefix) {
    addMessage(`${prefix} You can try again, or use the form above.`, 'system');
    addOptions(["Try again"], () => submitToFormspree());
  }

  function showSuccess() {
    addMessage("Thank you! Your enquiry has been sent. We'll reply within one to two working days.", 'bot');
  }
});
