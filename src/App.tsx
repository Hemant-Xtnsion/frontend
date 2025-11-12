import { useState, useEffect, useRef } from 'react'
import './App.css'

interface Message {
  role: 'bot' | 'user'
  content: string
  intent?: string
  feedbackSubmitted?: boolean
  suggestions?: string[]
}

function App() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [sessionId, setSessionId] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [recognition, setRecognition] = useState<any>(null)
  const [hasProcessedSpeech, setHasProcessedSpeech] = useState(false)
  const [showFeedback, setShowFeedback] = useState(false)
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false)
  const [queryResolved, setQueryResolved] = useState<string>('')
  const [userSatisfaction, setUserSatisfaction] = useState<number>(0)
  const [phoneNumber, setPhoneNumber] = useState<string>('')
  const [emailAddress, setEmailAddress] = useState<string>('')
  const [showPhoneInput, setShowPhoneInput] = useState<boolean>(false)
  const [phoneVerified, setPhoneVerified] = useState<boolean>(false)
  
  const feedRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const speechTimeoutRef = useRef<number | undefined>(undefined)
  const inactivityTimerRef = useRef<number | undefined>(undefined)

  // Initialize session ID - always generate new one on page load/refresh
  useEffect(() => {
    const sid = crypto.randomUUID()
    setSessionId(sid)
  }, [])

  // Initialize speech recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      const rec = new SpeechRecognition()
      
      rec.continuous = false
      rec.interimResults = true
      rec.lang = 'en-US'
      rec.maxAlternatives = 1
      
      rec.onstart = () => {
        setIsRecording(true)
        setHasProcessedSpeech(false)
        speechTimeoutRef.current = window.setTimeout(() => {
          if (rec) rec.stop()
        }, 10000)
      }
      
      rec.onresult = (event: any) => {
        let finalTranscript = ''
        let interimTranscript = ''
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript
          if (event.results[i].isFinal) {
            finalTranscript += transcript
          } else {
            interimTranscript += transcript
          }
        }
        
        if (interimTranscript) {
          setInputValue(interimTranscript)
        }
        
        if (finalTranscript && !hasProcessedSpeech) {
          setHasProcessedSpeech(true)
          setInputValue(finalTranscript.trim())
          
          setTimeout(() => {
            if (finalTranscript.trim() && !isRecording) {
              handleSubmit(new Event('submit') as any, finalTranscript.trim())
            }
          }, 1500)
        }
      }
      
      rec.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error)
        setIsRecording(false)
        setHasProcessedSpeech(false)
        
        if (speechTimeoutRef.current) {
          window.clearTimeout(speechTimeoutRef.current)
        }
        
        let errorMsg = 'Sorry, there was an error with speech recognition.'
        if (event.error === 'no-speech') {
          errorMsg = 'No speech detected. Please try again.'
        } else if (event.error === 'not-allowed') {
          errorMsg = 'Microphone access denied. Please allow microphone access.'
        } else if (event.error === 'network') {
          errorMsg = 'Network error. Please check your connection.'
        }
        
        if (inputRef.current) {
          const originalPlaceholder = inputRef.current.placeholder
          inputRef.current.placeholder = errorMsg
          inputRef.current.style.color = '#ef4444'
          setTimeout(() => {
            if (inputRef.current) {
              inputRef.current.placeholder = originalPlaceholder
              inputRef.current.style.color = ''
            }
          }, 3000)
        }
      }
      
      rec.onend = () => {
        setIsRecording(false)
        
        if (speechTimeoutRef.current) {
          window.clearTimeout(speechTimeoutRef.current)
        }
        
        if (inputValue.trim() && !hasProcessedSpeech) {
          setHasProcessedSpeech(true)
          setTimeout(() => {
            if (inputValue.trim()) {
              handleSubmit(new Event('submit') as any, inputValue.trim())
            }
          }, 500)
        }
      }
      
      setRecognition(rec)
    }
  }, [hasProcessedSpeech, isRecording, inputValue])

  // Auto scroll to bottom
  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight
    }
  }, [messages, isTyping])

  // Inactivity timer - auto-close chat and show feedback after 3 minutes of inactivity
  useEffect(() => {
    // Clear existing timer
    if (inactivityTimerRef.current) {
      window.clearTimeout(inactivityTimerRef.current)
      inactivityTimerRef.current = undefined
    }

    // Only start timer if chat is open, there are messages, and feedback hasn't been submitted
    if (isOpen && messages.length > 1 && !feedbackSubmitted && !isTyping) {
      // Set timer for 3 minutes (180000 ms)
      inactivityTimerRef.current = window.setTimeout(async () => {
        // Call backend to close session and trigger summary creation
        await callCloseSession('inactivity timeout')
        
        // Auto-close chat
        setIsOpen(false)
        
        // Refresh session for next time
        refreshSession()
        
        setTimeout(() => {
          setQueryResolved('')
          setUserSatisfaction(0)
          setShowFeedback(true)
        }, 300)
      }, 180000) // 3 minutes
    }

    // Cleanup on unmount or when conditions change
    return () => {
      if (inactivityTimerRef.current) {
        window.clearTimeout(inactivityTimerRef.current)
        inactivityTimerRef.current = undefined
      }
    }
  }, [isOpen, messages.length, feedbackSubmitted, isTyping, sessionId, phoneVerified])

  // Reset inactivity timer on user input changes
  useEffect(() => {
    if (isOpen && messages.length > 1 && !feedbackSubmitted && inputValue.length > 0) {
      // Clear existing timer
      if (inactivityTimerRef.current) {
        window.clearTimeout(inactivityTimerRef.current)
      }
      // Restart timer
      inactivityTimerRef.current = window.setTimeout(async () => {
        // Call backend to close session
        await callCloseSession('input change timer')
        setIsOpen(false)
        
        // Refresh session for next time
        refreshSession()
        
        setTimeout(() => {
          setQueryResolved('')
          setUserSatisfaction(0)
          setShowFeedback(true)
        }, 300)
      }, 180000) // 3 minutes
    }
  }, [inputValue, isOpen, messages.length, feedbackSubmitted, sessionId, phoneVerified])

  // Reset inactivity timer when recording starts
  useEffect(() => {
    if (isOpen && messages.length > 1 && !feedbackSubmitted && isRecording) {
      if (inactivityTimerRef.current) {
        window.clearTimeout(inactivityTimerRef.current)
      }
      inactivityTimerRef.current = window.setTimeout(async () => {
        // Call backend to close session
        await callCloseSession('recording timer')
        setIsOpen(false)
        
        // Refresh session for next time
        refreshSession()
        
        setTimeout(() => {
          setQueryResolved('')
          setUserSatisfaction(0)
          setShowFeedback(true)
        }, 300)
      }, 180000) // 3 minutes
    }
  }, [isRecording, isOpen, messages.length, feedbackSubmitted, sessionId, phoneVerified])

  const callCloseSession = async (context: string) => {
    if (!sessionId) {
      console.warn(`[FRONTEND] No sessionId available, skipping /close-session call (${context})`)
      return
    }
    
    console.log(`[FRONTEND] Calling /close-session (${context})`, { sessionId, phoneVerified, messagesLength: messages.length })
    try {
      const response = await fetch('/close-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ session_id: sessionId })
      })
      
      if (!response.ok) {
        console.error(`[FRONTEND] Session close failed (${context}) with status:`, response.status, response.statusText)
        const text = await response.text()
        console.error('[FRONTEND] Response body:', text)
        return
      }
      
      try {
        const data = await response.json()
        console.log(`[FRONTEND] Session close response (${context}):`, data)
      } catch (jsonError) {
        console.warn(`[FRONTEND] Response is not JSON, but status was OK (${context})`)
      }
    } catch (error) {
      console.error(`[FRONTEND] Error closing session (${context}):`, error)
    }
  }

  const showChat = () => {
    setIsOpen(true)
    // Show phone input if not verified
    if (!phoneVerified) {
      setShowPhoneInput(true)
    } else if (messages.length === 0) {
      setMessages([{
        role: 'bot',
        content: 'Hi there! 👋 I am Bella, your friendly cosmetic assistant at D Luxe Lab.\nWhat can I do for you today?',
        suggestions: [
          'Talk to a human',
          'Book an appointment',
          'What services do you offer?'
        ]
      }])
    }
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const normalizedPhone = phoneNumber.replace(/\D/g, '')
    if (normalizedPhone.length >= 10) {
      // Send phone number and email as first message
      // Format: "phone: {phone}, email: {email}" or just phone if no email
      let message = normalizedPhone
      if (emailAddress && emailAddress.includes('@')) {
        message = `phone: ${normalizedPhone}, email: ${emailAddress}`
      }
      setPhoneNumber('')
      setEmailAddress('')
      setShowPhoneInput(false)
      // Send phone number (and email) to backend - it will verify and respond
      // The backend response will indicate if verification was successful
      handleSubmit(e, message)
    } else {
      alert('Please enter a valid 10-digit phone number')
    }
  }

  const hideChat = async () => {
    // Clear inactivity timer when closing chat
    if (inactivityTimerRef.current) {
      window.clearTimeout(inactivityTimerRef.current)
      inactivityTimerRef.current = undefined
    }
    
    // Call backend to close session and trigger summary creation
    await callCloseSession('manual close')
    
    setIsOpen(false)
    
    // Refresh session for next time
    refreshSession()
    
    // Show feedback popup if there were messages and feedback hasn't been submitted
    if (messages.length > 1 && !feedbackSubmitted) {
      // Small delay to allow chat to close smoothly
      setTimeout(() => {
        setQueryResolved('')
        setUserSatisfaction(0)
        setShowFeedback(true)
      }, 300)
    }
  }

  const refreshSession = () => {
    // Generate new session ID
    const newSessionId = crypto.randomUUID()
    setSessionId(newSessionId)
    
    // Reset phone verification
    setPhoneVerified(false)
    setShowPhoneInput(true)
    setPhoneNumber('')
    setEmailAddress('')
    
    // Reset messages
    setMessages([])
    
    // Reset other states
    setInputValue('')
    setIsTyping(false)
    setFeedbackSubmitted(false)
    setQueryResolved('')
    setUserSatisfaction(0)
    
    // Clear inactivity timer
    if (inactivityTimerRef.current) {
      window.clearTimeout(inactivityTimerRef.current)
      inactivityTimerRef.current = undefined
    }
  }

  const handleFeedbackSubmit = async () => {
    if (!queryResolved || !userSatisfaction || userSatisfaction === 0) {
      return // Don't submit if both fields aren't selected
    }

    try {
      const response = await fetch('/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          session_id: sessionId,
          query_resolved: queryResolved,
          user_satisfaction: userSatisfaction.toString()
        })
      })
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      
      if (data.status === 'success') {
        setFeedbackSubmitted(true)
        // Close popup after successful submission
        setTimeout(() => {
          setShowFeedback(false)
        }, 500)
      } else {
        throw new Error(data.error || 'Failed to submit feedback')
      }
    } catch (error) {
      console.error('Error submitting feedback:', error)
      // Still close popup even on error to avoid blocking user
      setFeedbackSubmitted(true)
      setTimeout(() => {
        setShowFeedback(false)
      }, 500)
    }
  }

  const handleFeedbackSkip = () => {
    setFeedbackSubmitted(true)
    setShowFeedback(false)
  }

  const handleSuggestionClick = (suggestionText: string) => {
    // Call handleSubmit, passing the suggestion text as an override
    handleSubmit(new Event('submit') as any, suggestionText)
  }

  const handleThumbsFeedback = async (messageIndex: number, type: 'up' | 'down') => {
    const message = messages[messageIndex]
    if (!message || !message.intent || message.feedbackSubmitted) {
      return
    }

    try {
      const queryResolved = type === 'up' ? 'Yes' : 'No'
      const userSatisfaction = type === 'up' ? '5' : '1' // Thumbs up = 5 (very satisfied), Thumbs down = 1 (very dissatisfied)

      const response = await fetch('/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          session_id: sessionId,
          query_resolved: queryResolved,
          user_satisfaction: userSatisfaction
        })
      })
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      
      if (data.status === 'success') {
        // Mark this message as feedback submitted
        setMessages(prev => prev.map((msg, idx) => 
          idx === messageIndex 
            ? { ...msg, feedbackSubmitted: true }
            : msg
        ))
      } else {
        throw new Error(data.error || 'Failed to submit feedback')
      }
    } catch (error) {
      console.error('Error submitting thumbs feedback:', error)
      // Still mark as submitted to prevent repeated clicks
      setMessages(prev => prev.map((msg, idx) => 
        idx === messageIndex 
          ? { ...msg, feedbackSubmitted: true }
          : msg
      ))
    }
  }

  const handleSubmit = async (e: React.FormEvent, textOverride?: string) => {
    e.preventDefault()
    const text = textOverride || inputValue.trim()
    if (!text) return

    // Reset inactivity timer on user message
    if (inactivityTimerRef.current) {
      window.clearTimeout(inactivityTimerRef.current)
    }

    // Add user message
    setMessages(prev => [...prev, { role: 'user', content: text }])
    setInputValue('')
    setIsTyping(true)

    try {
      const response = await fetch('/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ session_id: sessionId, text })
      })
      const data = await response.json()
      
      setIsTyping(false)
      
      // Check if phone was verified (backend sets phone_verified in session)
      // If the response doesn't ask for phone again, consider it verified
      const replyLower = (data.reply || '').toLowerCase()
      const isPhoneRequest = replyLower.includes('phone') && (replyLower.includes('provide') || replyLower.includes('enter'))
      
      if (!isPhoneRequest && !phoneVerified) {
        // Phone was likely verified, hide phone input
        setPhoneVerified(true)
        setShowPhoneInput(false)
      } else if (isPhoneRequest && !phoneVerified) {
        // Still asking for phone, show input again
        setShowPhoneInput(true)
      }
      
      setMessages(prev => [...prev, { 
        role: 'bot', 
        content: data.reply,
        intent: data.intent || undefined,
        feedbackSubmitted: false,
        suggestions: data.suggestions || undefined
      }])
      
      // Reset inactivity timer after bot response
      if (isOpen && !feedbackSubmitted) {
        if (inactivityTimerRef.current) {
          window.clearTimeout(inactivityTimerRef.current)
        }
        inactivityTimerRef.current = window.setTimeout(async () => {
          // Call backend to close session
          await callCloseSession('bot response timer')
          setIsOpen(false)
          
          // Refresh session for next time
          refreshSession()
          
          setTimeout(() => {
            setShowFeedback(true)
          }, 300)
        }, 180000) // 3 minutes
      }
    } catch (error) {
      console.error('Error:', error)
      setIsTyping(false)
      setMessages(prev => [...prev, { role: 'bot', content: 'Sorry, there was an error. Please try again.' }])
      
      // Reset inactivity timer even on error
      if (isOpen && !feedbackSubmitted) {
        if (inactivityTimerRef.current) {
          window.clearTimeout(inactivityTimerRef.current)
        }
        inactivityTimerRef.current = window.setTimeout(async () => {
          // Call backend to close session
          await callCloseSession('error handler timer')
          setIsOpen(false)
          
          // Refresh session for next time
          refreshSession()
          
          setTimeout(() => {
            setShowFeedback(true)
          }, 300)
        }, 180000) // 3 minutes
      }
    }
  }

  const startRecording = () => {
    if (recognition && !isRecording) {
      try {
        setHasProcessedSpeech(false)
        recognition.start()
      } catch (error) {
        console.error('Error starting speech recognition:', error)
      }
    }
  }

  const stopRecording = () => {
    if (recognition && isRecording) {
      recognition.stop()
    }
  }

  return (
    <div className="app">
      <header>
        <div className="header-left">
          <div className="header-logo">D Luxe Lab</div>
        </div>
        <div className="header-contact">📍 70 Yorkville Avenue, Units 31 & 32, Toronto</div>
      </header>
      <main>
        <div className="hero-content">
          <h1 className="hero-title">HALT THE<br />AGING<br />PROCESS</h1>
          <p className="hero-subtitle">Your premier destination for cosmetic and aesthetic treatments in Toronto. Experience cutting-edge beauty technology with our AI-powered assistant, Bella.</p>
          <div className="hero-buttons">
            <button className="btn-primary" onClick={showChat}>FREE CONSULTATION</button>
            <button className="btn-secondary" onClick={showChat}>ABOUT US</button>
          </div>
        </div>
      </main>

      {/* Chat launcher button */}
      {!isOpen && (
        <button
          id="xara-launcher"
          title="Chat with Bella - Cosmetic Assistant"
          onClick={showChat}
        >
          <img
            src="https://res.cloudinary.com/dgdcspjw6/image/upload/v1759636214/Untitled_design_39_a43luz.png"
            alt="D Luxe Lab Logo"
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: 'white',
              padding: '2px'
            }}
          />
        </button>
      )}

      {/* Chat widget */}
      {isOpen && (
        <div id="xara-chat" aria-live="polite">
          <div id="xara-header">
            <div id="xara-title">
              <img 
                src="https://res.cloudinary.com/dgdcspjw6/image/upload/v1759636214/Untitled_design_39_a43luz.png" 
                alt="D Luxe Lab Logo" 
                style={{ width: '24px', height: '24px', borderRadius: '4px', marginRight: '8px' }}
              />
              Bella Cosmetic Assistant
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button id="xara-refresh" title="Refresh Session" onClick={refreshSession} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '18px', padding: '4px 8px', color: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🔄</button>
              <button id="xara-close" title="Close" onClick={hideChat}>✕</button>
            </div>
          </div>
          <div id="xara-body">
            {showPhoneInput && !phoneVerified ? (
              <div style={{ 
                padding: '20px', 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '200px',
                gap: '16px'
              }}>
                <div style={{ 
                  fontSize: '16px', 
                  fontWeight: 600, 
                  marginBottom: '8px',
                  textAlign: 'center'
                }}>
                  Welcome to D Luxe Lab! 👋
                </div>
                <div style={{ 
                  fontSize: '14px', 
                  color: '#666',
                  textAlign: 'center',
                  marginBottom: '8px'
                }}>
                  To get started and load your profile, please provide your 10-digit phone number.
                </div>
                <form onSubmit={handlePhoneSubmit} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <input
                    type="tel"
                    placeholder="Enter your phone number"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: '1px solid #ddd',
                      borderRadius: '8px',
                      fontSize: '14px',
                      outline: 'none'
                    }}
                    maxLength={15}
                    required
                  />
                  <input
                    type="email"
                    placeholder="Enter your email (optional)"
                    value={emailAddress}
                    onChange={(e) => setEmailAddress(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: '1px solid #ddd',
                      borderRadius: '8px',
                      fontSize: '14px',
                      outline: 'none'
                    }}
                  />
                  <button
                    type="submit"
                    style={{
                      width: '100%',
                      padding: '12px',
                      backgroundColor: '#6366f1',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Continue
                  </button>
                </form>
              </div>
            ) : (
              <div id="xara-feed" ref={feedRef}>
                {messages.map((message, index) => (
                <div key={index} className={`msg ${message.role}`}>
                  <div className="avatar">
                    {message.role === 'bot' ? (
                      <img
                        src="https://res.cloudinary.com/dgdcspjw6/image/upload/v1759636214/Untitled_design_39_a43luz.png"
                        alt="Agent"
                        style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', background: '#ffffff', padding: '1px' }}
                      />
                    ) : (
                      <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 600, fontSize: '12px' }}>👤</div>
                    )}
                  </div>
                  <div className="bubble-container">
                    <div className="bubble">
                      {(() => {
                        const content = String(message.content || '');
                        return content
                          .replace(/\*\*(.*?)\*\*/g, '$1') // Remove **bold** formatting
                          .replace(/\*(.*?)\*/g, '$1')     // Remove *italic* formatting
                          .replace(/<br\s*\/?>/gi, '\n')   // Convert <br> tags to newlines
                          .split('\n')                     // Split by newlines
                          .map((line, index) => (
                            <div key={index}>
                              {line}
                              {index < content.split('\n').length - 1 && <br />}
                            </div>
                          ));
                      })()}
                    </div>
                    {message.role === 'bot' && message.intent && !message.feedbackSubmitted && 
                     ['location_info', 'parking_info', 'directions', 'general_inquiry', 'aftercare', 'promotions'].includes(message.intent) && (
                      <div className="message-feedback">
                        <button
                          className="feedback-thumb feedback-thumb-up"
                          onClick={() => handleThumbsFeedback(index, 'up')}
                          title="Thumbs up - Query resolved"
                        >
                          👍
                        </button>
                        <button
                          className="feedback-thumb feedback-thumb-down"
                          onClick={() => handleThumbsFeedback(index, 'down')}
                          title="Thumbs down - Query not resolved"
                        >
                          👎
                        </button>
                      </div>
                    )}
                    {/* Render suggestions if they exist and are the last message */}
                    {message.role === 'bot' && 
                     index === messages.length - 1 && 
                     message.suggestions && 
                     message.suggestions.length > 0 && (
                      <div className="suggestions-container">
                        {message.suggestions.map((suggestion, sIndex) => (
                          <button
                            key={sIndex}
                            className="suggestion-chip"
                            onClick={() => handleSuggestionClick(suggestion)}
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
                {isTyping && (
                  <div className="msg bot" id="typing-indicator">
                    <div className="avatar">
                      <img
                        src="https://res.cloudinary.com/dgdcspjw6/image/upload/v1759636214/Untitled_design_39_a43luz.png"
                        alt="Agent"
                        style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', background: '#ffffff', padding: '1px' }}
                      />
                    </div>
                    <div className="typing-dots">
                      <div className="typing-dot"></div>
                      <div className="typing-dot"></div>
                      <div className="typing-dot"></div>
                    </div>
                  </div>
                )}
              </div>
            )}
            {!showPhoneInput && phoneVerified && (
              <form id="xara-form" onSubmit={handleSubmit}>
              <button 
                type="button" 
                id="mic" 
                title="Hold to speak"
                className={isRecording ? 'recording' : ''}
                onMouseDown={startRecording}
                onMouseUp={stopRecording}
                onMouseLeave={stopRecording}
                onTouchStart={(e) => { e.preventDefault(); startRecording(); }}
                onTouchEnd={(e) => { e.preventDefault(); stopRecording(); }}
              >
                {isRecording ? '⏹️' : '🎤'}
        </button>
              <input 
                id="xara-input" 
                ref={inputRef}
                type="text" 
                placeholder="Type your message or hold 🎤 to speak..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
              />
                <button id="xara-send" type="submit" title="Send message"></button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Feedback Popup */}
      {showFeedback && (
        <div className="feedback-overlay" onClick={handleFeedbackSkip}>
          <div className="feedback-popup" onClick={(e) => e.stopPropagation()}>
            <div className="feedback-header">
              <h3>Your Feedback Matters</h3>
              <button className="feedback-close" onClick={handleFeedbackSkip}>✕</button>
            </div>
            <div className="feedback-content">
              <div className="feedback-question">
                <label>Was your query resolved?</label>
                <div className="feedback-options">
                  <button
                    className={`feedback-btn ${queryResolved === 'Yes' ? 'active' : ''}`}
                    onClick={() => setQueryResolved('Yes')}
                  >
                    Yes
                  </button>
                  <button
                    className={`feedback-btn ${queryResolved === 'Neutral' ? 'active' : ''}`}
                    onClick={() => setQueryResolved('Neutral')}
                  >
                    Neutral
                  </button>
                  <button
                    className={`feedback-btn ${queryResolved === 'No' ? 'active' : ''}`}
                    onClick={() => setQueryResolved('No')}
                  >
                    No
                  </button>
                </div>
              </div>
              <div className="feedback-question">
                <label>Rate your satisfaction (1-5 stars)</label>
                <div className="star-rating">
                  {[1, 2, 3, 4, 5].map((rating) => (
                    <button
                      key={rating}
                      type="button"
                      className={`star-btn ${userSatisfaction >= rating ? 'active' : ''}`}
                      onClick={() => setUserSatisfaction(rating)}
                      onMouseEnter={(e) => {
                        if (userSatisfaction === 0) {
                          const stars = e.currentTarget.parentElement?.querySelectorAll('.star-btn');
                          stars?.forEach((star, index) => {
                            if (index < rating) {
                              star.classList.add('hover');
                            } else {
                              star.classList.remove('hover');
                            }
                          });
                        }
                      }}
                      onMouseLeave={(e) => {
                        const stars = e.currentTarget.parentElement?.querySelectorAll('.star-btn');
                        stars?.forEach((star) => star.classList.remove('hover'));
                      }}
                      title={`${rating} star${rating > 1 ? 's' : ''}`}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>
              <div className="feedback-actions">
                <button
                  className="feedback-submit"
                  onClick={handleFeedbackSubmit}
                  disabled={!queryResolved || !userSatisfaction || userSatisfaction === 0}
                >
                  Submit Feedback
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
  )
}

export default App
