

"use client";

import { useState, useRef, useEffect, type RefObject } from "react"; // Added RefObject
import { analyzeMentalHealth, AnalyzeMentalHealthOutput } from "@/ai/flows/analyze-mental-health";
import { chatWithBot, ChatMessage } from "@/ai/flows/chatbot-flow"; // Import chatbot flow and types
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input"; // Import Input for chatbot
import { ScrollArea } from "@/components/ui/scroll-area"; // Import ScrollArea for chat history
import { useToast } from "@/hooks/use-toast";
import { Mic, Camera, Menu, Send, Github, Linkedin } from "lucide-react"; // Added Send, Github, and Linkedin icons
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Sidebar, SidebarContent, SidebarHeader, SidebarProvider, useSidebar } from "@/components/ui/sidebar"; // Imported useSidebar
import { Toaster } from "@/components/ui/toaster";

// Define a type for individual analysis results (conditions + emotion)
type AnalysisResult = NonNullable<AnalyzeMentalHealthOutput['textAnalysis']>; // Use NonNullable to ensure it's not null

// Gmail SVG Icon
const GmailIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
  >
    <path d="M20 4H4C2.9 4 2 4.9 2 6V18C2 19.1 2.9 20 4 20H20C21.1 20 22 19.1 22 18V6C22 4.9 21.1 4 20 4ZM20 8L12 13L4 8V6L12 11L20 6V8Z" />
  </svg>
);

// Microsoft SVG Icon
const MicrosoftIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
  >
    <path d="M11.025 2.204H2.246v8.779h8.779V2.204zm0 9.804H2.246v8.779h8.779v-8.779zm1.028-9.804h8.779v8.779h-8.779V2.204zm0 9.804h8.779v8.779h-8.779v-8.779z"/>
  </svg>
);

// Coursera SVG Icon (Simple Representation)
const CourseraIcon = ({ className }: { className?: string }) => (
    <svg
        className={className}
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
    >
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-3.5-9.5c0-.83.67-1.5 1.5-1.5h4c.83 0 1.5.67 1.5 1.5v3c0 .83-.67 1.5-1.5 1.5h-4c-.83 0-1.5-.67-1.5-1.5v-3zm1.5 0v3h4v-3h-4z" />
    </svg>
);

// Inner component to consume sidebar context for the trigger button
const SidebarToggleButton = () => {
  const { toggleSidebar, isMobile } = useSidebar();
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleSidebar} 
      disabled={!isMobile} // Now only enabled on mobile
      className="h-8 w-8 rounded-full hover:bg-primary/10 data-[state=open]:bg-accent md:hidden" // Hide on medium and up screens
      aria-label="Toggle Sidebar"
    >
      <Menu className="h-6 w-6 text-primary" />
      <span className="sr-only">Toggle Sidebar</span>
    </Button>
  );
};


export default function Home() {
  const [textInput, setTextInput] = useState("");
  const [voiceInputDataUri, setVoiceInputDataUri] = useState<string | null>(null);
  const [videoInputDataUri, setVideoInputDataUri] = useState<string | null>(null);

  // State to hold the analysis results for each input type
  const [lastTextAnalysis, setLastTextAnalysis] = useState<AnalysisResult | null>(null);
  const [lastVoiceAnalysis, setLastVoiceAnalysis] = useState<AnalysisResult | null>(null);
  const [lastVideoAnalysis, setLastVideoAnalysis] = useState<AnalysisResult | null>(null);

  const [chatHistory, setChatHistory] = useState<
    { input: string; diagnosis: string; emotion?: string | null }[]
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(true); 

  const [showCamera, setShowCamera] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState(false);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [mediaRecorderVoice, setMediaRecorderVoice] = useState<MediaRecorder | null>(null);
  const [isRecordingVideo, setIsRecordingVideo] = useState(false);
  const [mediaRecorderVideo, setMediaRecorderVideo] = useState<MediaRecorder | null>(null);

  // --- Chatbot State ---
  const [chatbotHistory, setChatbotHistory] = useState<ChatMessage[]>([
     { role: 'model', text: "Hello! How can I help you today? Feel free to chat, or start an analysis using the options on the left." }
  ]);
  const [chatbotInput, setChatbotInput] = useState("");
  const [isBotLoading, setIsBotLoading] = useState(false);
  const [detectedCondition, setDetectedCondition] = useState<string | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null); 
  const [isChatBotRecording, setIsChatBotRecording] = useState(false); 
  const [chatBotMediaRecorder, setChatBotMediaRecorder] = useState<MediaRecorder | null>(null); 

  // --- Scroll chat to bottom ---
   useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatbotHistory]); 


   // --- Function to initiate chatbot conversation (used internally by handleAnalyze) ---
   const initiateChatbotWithCondition = async (condition: string | null) => {
    if (isBotLoading) return;

    setDetectedCondition(condition); 
    setIsBotLoading(true);

    const currentHistory = chatbotHistory;

    try {
        const response = await chatWithBot({
            userMessage: "", 
            conversationHistory: currentHistory, 
            detectedCondition: condition, 
             audioInputDataUri: undefined, 
        });
        setChatbotHistory(prev => {
            const lastMessage = prev[prev.length - 1];
            if (lastMessage?.role === 'model' && lastMessage.text.includes("Analysis complete")) {
                 return [...prev.slice(0, -1), { role: 'model', text: response.botResponse }];
            } else {
                return [...prev, { role: 'model', text: response.botResponse }];
            }
        });
    } catch (error: any) {
        console.error("Error initiating chatbot with condition:", error);
         setChatbotHistory(prev => [...prev, { role: 'model', text: "I've completed the analysis, but encountered an issue starting the follow-up chat. How can I help otherwise?" }]);
         toast({
           title: "Chatbot Error",
           description: "Could not start the condition-based chat.",
           variant: "destructive",
         });
    } finally {
        setIsBotLoading(false);
    }
   };

    // --- Function to send text OR audio message to chatbot ---
   const handleSendMessageToBot = async (audioDataUri?: string) => {
    const textMessage = chatbotInput.trim();
    if ((!textMessage && !audioDataUri) || isBotLoading) return; 

    const userMessageContent = audioDataUri ? "🎤 Voice Input" : textMessage;
    const newUserMessage: ChatMessage = { role: 'user', text: userMessageContent };
    const updatedHistory = [...chatbotHistory, newUserMessage];

    setChatbotHistory(updatedHistory);
    setChatbotInput(""); 
    setIsBotLoading(true);

    try {
         console.log("Sending to chatWithBot:", {
            userMessage: audioDataUri ? undefined : textMessage,
            audioInputDataUri: audioDataUri ? `data:${audioDataUri.substring(5, audioDataUri.indexOf(';'))};base64,...(length ${audioDataUri.length})` : undefined, 
            conversationHistoryLength: chatbotHistory.length, 
            detectedCondition: detectedCondition,
        });
        const response = await chatWithBot({
            userMessage: audioDataUri ? undefined : textMessage, 
            audioInputDataUri: audioDataUri, 
            conversationHistory: chatbotHistory, 
            detectedCondition: detectedCondition,
        });
        setChatbotHistory([...updatedHistory, { role: 'model', text: response.botResponse }]);
    } catch (error: any) {
        console.error("Error sending message to chatbot:", error);
        const errorMessage = error?.message?.includes("Schema validation failed")
           ? "Chatbot processing error. Please try again." 
           : error?.message?.includes("503 Service Unavailable")
           ? "Chatbot service is currently busy. Please try again."
           : error.message || "Failed to get response from chatbot.";

        setChatbotHistory([...updatedHistory, { role: 'model', text: `Sorry, I encountered an error: ${errorMessage}` }]);
        toast({
            title: "Chatbot Error",
            description: errorMessage,
            variant: "destructive",
        });
    } finally {
        setIsBotLoading(false);
    }
   };


   // --- Handle pressing Enter in chatbot input ---
    const handleChatInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault(); 
            handleSendMessageToBot(); 
        }
    };


  const handleAnalyze = async () => {
    if (!textInput && !voiceInputDataUri && !videoInputDataUri) {
        toast({
            title: "Input Required",
            description: "Please provide text, voice, or video input to analyze.",
            variant: "destructive",
        });
        return;
    }

    setIsLoading(true);
    setLastTextAnalysis(null);
    setLastVoiceAnalysis(null);
    setLastVideoAnalysis(null);
    
    let currentInputDisplay = textInput || (voiceInputDataUri ? 'Voice Input' : (videoInputDataUri ? 'Video Input' : 'Input'));
    let tempHistoryItem = { input: currentInputDisplay, diagnosis: 'Analyzing...', emotion: null };
    setChatHistory(prevHistory => [tempHistoryItem, ...prevHistory.slice(0, 4)]);

    try {
      const result = await analyzeMentalHealth({
        textInput: textInput || undefined,
        voiceInputDataUri: voiceInputDataUri || undefined,
        videoInputDataUri: videoInputDataUri || undefined,
      });

      let newHistoryItems: typeof chatHistory = [];
      let primaryCondition: string | null = null; 

      if (result.textAnalysis) {
        setLastTextAnalysis(result.textAnalysis);
        const textDiagnosis = result.textAnalysis.conditions.map(c => `${c.conditionName} (${c.confidencePercentage.toFixed(1)}%)`).join(', ');
        const emotion = result.textAnalysis.emotion;
        newHistoryItems.push({ input: textInput || "Text Input", diagnosis: textDiagnosis || 'N/A', emotion: emotion });
         if (!primaryCondition && result.textAnalysis.conditions.length > 0) {
            primaryCondition = result.textAnalysis.conditions[0].conditionName;
         }
      }

      if (result.voiceAnalysis) {
        setLastVoiceAnalysis(result.voiceAnalysis);
        const voiceDiagnosis = result.voiceAnalysis.conditions.map(c => `${c.conditionName} (${c.confidencePercentage.toFixed(1)}%)`).join(', ');
        const emotion = result.voiceAnalysis.emotion;
        newHistoryItems.push({ input: 'Voice Input', diagnosis: voiceDiagnosis || 'N/A', emotion: emotion });
         if (!primaryCondition && result.voiceAnalysis.conditions.length > 0) {
            primaryCondition = result.voiceAnalysis.conditions[0].conditionName;
         }
      }

      if (result.videoAnalysis) {
        setLastVideoAnalysis(result.videoAnalysis);
        const videoDiagnosis = result.videoAnalysis.conditions.map(c => `${c.conditionName} (${c.confidencePercentage.toFixed(1)}%)`).join(', ');
        const emotion = result.videoAnalysis.emotion;
        newHistoryItems.push({ input: 'Video Input', diagnosis: videoDiagnosis || 'N/A', emotion: emotion });
         if (!primaryCondition && result.videoAnalysis.conditions.length > 0) {
            primaryCondition = result.videoAnalysis.conditions[0].conditionName;
         }
      }

      setChatHistory(prevHistory => [
          ...newHistoryItems,
          ...prevHistory.filter(item => item.diagnosis !== 'Analyzing...').slice(0, 5 - newHistoryItems.length)
      ]);

       setDetectedCondition(primaryCondition);

       if (primaryCondition) {
           await initiateChatbotWithCondition(primaryCondition);
       } else {
           setChatbotHistory(prev => {
                const lastMessage = prev[prev.length - 1];
                if (!isBotLoading && lastMessage?.text !== "Analysis complete. No specific condition was strongly indicated. Let me know if you'd like to discuss the results or anything else!") {
                    return [...prev, { role: 'model', text: "Analysis complete. No specific condition was strongly indicated. Let me know if you'd like to discuss the results or anything else!" }];
                }
                return prev; 
            });
       }


    } catch (error: any) {
      console.error("Error analyzing mental health:", error);
       let errorMessage = "Failed to analyze mental health.";
      if (error.message && (error.message.includes('503') || error.message.toLowerCase().includes('overloaded') || error.message.toLowerCase().includes('service unavailable'))) {
         errorMessage = "The analysis service is currently busy. Please try again in a few moments.";
         toast({
           title: "Service Busy",
           description: errorMessage,
           variant: "destructive",
         });
      } else {
          errorMessage = error.message || errorMessage;
          toast({
            title: "Error",
            description: errorMessage,
            variant: "destructive",
          });
      }
       setChatHistory(prevHistory => prevHistory.filter(item => item.diagnosis !== 'Analyzing...'));
        setChatbotHistory(prev => [...prev, { role: 'model', text: `Sorry, there was an error during the analysis: ${errorMessage}` }]);
       setDetectedCondition(null); 
    } finally {
      setTextInput(""); 
      setVoiceInputDataUri(null); 
      setVideoInputDataUri(null); 
       if (videoRef.current && videoRef.current.srcObject && !isRecordingVideo) {
            const stream = videoRef.current.srcObject as MediaStream;
            stream.getTracks().forEach(track => track.stop()); 
            videoRef.current.srcObject = null;
            setShowCamera(false); 
        }
      setIsLoading(false);
    }
  };

  // --- Voice Recording Logic (Analysis) ---
  const startRecordingVoice = async () => {
    setVoiceInputDataUri(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      setMediaRecorderVoice(recorder);

      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) { 
             chunks.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: "audio/webm" }); 
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => {
          const base64data = reader.result as string;
          setVoiceInputDataUri(base64data);
          console.log("Voice recording stopped, data URI set for analysis.");
           toast({ title: "Recording Complete", description: "Voice input ready for analysis." });
        };
        stream.getTracks().forEach(track => track.stop()); 
        setIsRecordingVoice(false);
      };

      recorder.start();
      setIsRecordingVoice(true);
      toast({ title: "Recording Started", description: "Recording voice..." });
    } catch (error: any) {
      console.error("Error starting voice recording:", error);
      toast({
        title: "Error",
        description: "Failed to start voice recording. Check microphone permissions.",
        variant: "destructive",
      });
      setIsRecordingVoice(false);
    }
  };

  const stopRecordingVoice = () => {
    if (mediaRecorderVoice && isRecordingVoice) {
      mediaRecorderVoice.stop();
      console.log("Stopping voice recording...");
    }
  };

  // --- Chatbot Voice Recording Logic ---
  const startChatBotRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
       let options = { mimeType: 'audio/webm;codecs=opus' };
       if (!MediaRecorder.isTypeSupported(options.mimeType)) {
           console.warn(`${options.mimeType} not supported, trying audio/webm`);
           options = { mimeType: 'audio/webm' };
           if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                console.warn(`audio/webm not supported, using default`);
                options = { mimeType: '' }; 
            }
       }
       console.log("Using mimeType for chatbot recording:", options.mimeType || 'browser default');

      const recorder = new MediaRecorder(stream, options);
      setChatBotMediaRecorder(recorder);

      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
         if (e.data.size > 0) { 
            console.log(`Chatbot recording chunk size: ${e.data.size}`);
            chunks.push(e.data);
         } else {
            console.log("Chatbot recording chunk size: 0");
         }
      };

      recorder.onstop = () => {
        if (chunks.length === 0) {
             console.error("Chatbot recording stopped but no data chunks received.");
             toast({ title: "Recording Error", description: "No audio data was captured.", variant: "destructive" });
             setIsChatBotRecording(false);
             stream.getTracks().forEach(track => track.stop());
             return; 
        }

        const blob = new Blob(chunks, { type: options.mimeType || 'audio/webm' });
        console.log(`Chatbot recording stopped. Blob size: ${blob.size}, type: ${blob.type}`);
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => {
          const base64data = reader.result as string;
          console.log("Chatbot recording data URI ready (first 50 chars):", base64data ? base64data.substring(0, 50) + '...' : 'null', `Full length: ${base64data?.length}`);
          if (base64data) {
             handleSendMessageToBot(base64data);
          } else {
             console.error("Failed to generate data URI from chatbot recording.");
             toast({ title: "Processing Error", description: "Could not process recorded audio.", variant: "destructive"});
          }
        };
         reader.onerror = (error) => {
             console.error("FileReader error during chatbot recording processing:", error);
             toast({ title: "Processing Error", description: "Could not read recorded audio data.", variant: "destructive"});
         };
        stream.getTracks().forEach(track => track.stop()); 
        setIsChatBotRecording(false);
      };

       recorder.onerror = (event: Event) => {
           console.error("Chatbot MediaRecorder error:", event);
            let errorMsg = "An error occurred during chatbot audio recording.";
             if (event && 'error' in event) {
                const error = (event as any).error;
                if (error instanceof DOMException) {
                    errorMsg += ` Error: ${error.name} - ${error.message}`;
                }
            }
            toast({ title: "Recording Error", description: errorMsg, variant: "destructive" });
            stream?.getTracks().forEach(track => track.stop());
           setIsChatBotRecording(false);
       };


      recorder.start();
      setIsChatBotRecording(true);
      toast({ title: "Chatbot Recording", description: "Listening..." });
    } catch (error: any) {
      console.error("Error starting chatbot voice recording:", error);
       let errorDesc = "Could not start microphone for chat.";
        if (error.name === 'NotAllowedError') {
            errorDesc = "Microphone access denied. Please allow access in your browser settings.";
        } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
            errorDesc = "No microphone found. Please connect a microphone.";
        }
        toast({
            title: "Mic Error",
            description: errorDesc,
            variant: "destructive",
        });
      setIsChatBotRecording(false);
    }
  };

  const stopChatBotRecording = () => {
    if (chatBotMediaRecorder && isChatBotRecording) {
      chatBotMediaRecorder.stop();
       console.log("Stopping chatbot recording...");
    }
  };


  // --- Video Recording Logic ---
   useEffect(() => {
        return () => {
             if (videoRef.current && videoRef.current.srcObject) {
                const stream = videoRef.current.srcObject as MediaStream;
                stream.getTracks().forEach(track => track.stop());
            }
            [mediaRecorderVoice, mediaRecorderVideo, chatBotMediaRecorder].forEach(recorder => {
                 if (recorder && recorder.state !== 'inactive') {
                    recorder.stop();
                }
            });
        };
    }, [mediaRecorderVoice, mediaRecorderVideo, chatBotMediaRecorder]); 

  const requestCameraAndStartStream = async (): Promise<MediaStream | null> => {
      try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            setHasCameraPermission(true);
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                 videoRef.current.play().catch(e => console.error("Video play error:", e));
            }
             setShowCamera(true); 
            return stream;
        } catch (error) {
            console.error('Error accessing camera/mic:', error);
            setHasCameraPermission(false);
            toast({
                variant: 'destructive',
                title: 'Camera/Mic Access Denied',
                description: 'Please enable camera and microphone permissions.',
            });
            setShowCamera(false); 
            return null;
        }
  };


  const startRecordingVideo = async () => {
    setVideoInputDataUri(null);
    setShowCamera(true); 

    const stream = await requestCameraAndStartStream();
    if (!stream) {
        return;
    }


    try {
       let options = { mimeType: 'video/webm;codecs=vp9,opus' };
       if (!MediaRecorder.isTypeSupported(options.mimeType)) {
           console.log(options.mimeType + ' is not Supported');
           options = { mimeType: 'video/webm;codecs=vp8,opus' };
           if (!MediaRecorder.isTypeSupported(options.mimeType)) {
               console.log(options.mimeType + ' is not Supported');
               options = { mimeType: 'video/webm' };
                if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                   console.log(options.mimeType + ' is not Supported');
                   options = { mimeType: '' }; 
                }
           }
       }
        console.log("Using mimeType:", options.mimeType || 'browser default');

      const recorder = new MediaRecorder(stream, options);
      setMediaRecorderVideo(recorder);

      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) { 
            chunks.push(e.data);
        }
      };

      recorder.onstop = () => {
         if (chunks.length === 0) {
             console.error("Video recording stopped but no data chunks received.");
             toast({ title: "Recording Error", description: "No video data was captured.", variant: "destructive" });
             setIsRecordingVideo(false);
             stream.getTracks().forEach(track => track.stop());
              if (videoRef.current) videoRef.current.srcObject = null;
              setShowCamera(false);
             return; 
        }
        const blob = new Blob(chunks, { type: options.mimeType || 'video/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => {
          const base64data = reader.result as string;
          setVideoInputDataUri(base64data);
          console.log("Video recording stopped, data URI set for analysis.");
           toast({ title: "Recording Complete", description: "Video input ready for analysis." });
        };
         reader.onerror = (error) => {
             console.error("FileReader error during video recording processing:", error);
             toast({ title: "Processing Error", description: "Could not read recorded video data.", variant: "destructive"});
         };
        setIsRecordingVideo(false);
      };

        recorder.onerror = (event: Event) => {
            console.error("MediaRecorder error:", event);
            let errorDetail = 'Unknown error';
             if ('error' in event && (event as any).error instanceof DOMException) {
                errorDetail = (event as any).error.message;
            }
             toast({ title: "Recording Error", description: `An error occurred during video recording: ${errorDetail}`, variant:"destructive" });
             stream?.getTracks().forEach(track => track.stop()); 
             if (videoRef.current) videoRef.current.srcObject = null;
             setIsRecordingVideo(false);
             setShowCamera(false); 
        };

      recorder.start();
      setIsRecordingVideo(true);
      toast({ title: "Recording Started", description: "Recording video and audio..." });

    } catch (error: any) {
      console.error("Error starting video recording:", error);
      toast({
        title: "Setup Error",
        description: error.message || "Failed to initialize video recording.",
        variant: "destructive",
      });
        stream?.getTracks().forEach(track => track.stop()); 
        if (videoRef.current) videoRef.current.srcObject = null;
      setIsRecordingVideo(false);
      setShowCamera(false); 
    }
  };

  const stopRecordingVideo = () => {
    if (mediaRecorderVideo && isRecordingVideo) {
      mediaRecorderVideo.stop();
      console.log("Stopping video recording...");
    }
  };


   // --- Helper to render analysis results ---
  const renderAnalysisResult = (title: string, analysis: AnalysisResult | null) => {
    if (!analysis || (!analysis.conditions.length && !analysis.emotion)) return null;

    const inputType = title.match(/\(([^)]+)\)/)?.[1].toLowerCase() || 'input';

    return (
      <Card className="mb-4 shadow-sm border border-border">
        <CardHeader>
          <CardTitle className="text-xl">{`Analysis (${inputType.charAt(0).toUpperCase() + inputType.slice(1)})`}</CardTitle>
           <CardDescription className="text-card-foreground">
            Based on the {inputType} provided:
          </CardDescription>
        </CardHeader>
        <CardContent>
           {analysis.emotion && (
                <div className="mb-4">
                    <p className="font-semibold text-lg text-card-foreground">Detected Emotion:</p>
                    <p className="font-bold text-primary">{analysis.emotion}</p>
                </div>
            )}

          {analysis.conditions.length > 0 ? (
            <>
             <p className="font-semibold text-lg mb-2 text-card-foreground">Potential Conditions:</p>
            {analysis.conditions.map((condition, index) => (
              <div key={index} className="mb-6 last:mb-0 pl-2 border-l-2 border-primary ml-1">
                <p className="font-semibold text-base text-card-foreground">{condition.conditionName}</p>
                <p className="text-primary font-extrabold text-sm">
                  <span className="text-primary font-extrabold">Confidence:</span> {condition.confidencePercentage.toFixed(1)}%
                </p>
                {condition.suggestedImprovements && condition.suggestedImprovements.length > 0 && (
                     <div className="mt-2">
                        <h4 className="text-sm font-semibold text-card-foreground">Suggestions:</h4>
                        <ul className="list-disc ml-5 mt-1 text-xs space-y-1 text-card-foreground">
                          {condition.suggestedImprovements.map((suggestion, i) => (
                            <li key={i}>{suggestion}</li>
                          ))}
                        </ul>
                    </div>
                )}
              </div>
            ))}
            </>
          ) : (
              !analysis.emotion && <p className="text-card-foreground italic">No significant conditions or emotions detected for {inputType}.</p>
          )}
           {analysis.conditions.length === 0 && analysis.emotion && <p className="text-card-foreground italic">No significant conditions detected for {inputType}.</p>}


        </CardContent>
      </Card>
    );
  };


  return (
    <SidebarProvider open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
      <Toaster />
      <div className="flex flex-col md:flex-row min-h-screen bg-background">
         <Sidebar collapsible="icon" className="md:flex-shrink-0"> 
          <SidebarHeader className="flex items-center justify-between p-2 border-b border-sidebar-border">
             <ConditionalSidebarHeaderTitle />
            <SidebarToggleButton />
          </SidebarHeader>
          <SidebarContent className="p-0">
             <div className="chat-history p-2 overflow-y-auto">
                {chatHistory.map((item, index) => (
                  <div key={index} className="chat-history-item p-3 mb-2 rounded bg-card border border-border shadow-sm">
                     <p className={`input text-sm mb-1 text-card-foreground ${isSidebarOpen ? '' : 'truncate'}`}>
                        <strong className="text-card-foreground">In:</strong> <span className="text-card-foreground">{item.input}</span>
                     </p>
                     <p className={`diagnosis text-sm font-medium text-card-foreground ${isSidebarOpen ? '' : 'truncate'}`}>
                        <strong className="text-card-foreground">Dx:</strong> {item.diagnosis || 'N/A'}
                     </p>
                     {item.emotion && (
                         <p className={`emotion text-sm font-medium ${isSidebarOpen ? '' : 'truncate'}`}>
                             <strong className="text-black font-bold">Em:</strong> <span className="text-card-foreground">{item.emotion}</span>
                         </p>
                     )}
                  </div>
                ))}
                 {chatHistory.length === 0 && (
                     <p className="text-sm text-muted-foreground p-4 text-center">No history yet.</p>
                 )}
              </div>
          </SidebarContent>
        </Sidebar>
         <div className={`flex flex-col flex-grow pt-4 transition-all duration-300 ease-in-out ${!isSidebarOpen ? 'md:ml-0' : 'md:ml-[var(--sidebar-width)]'}`}>
           <header className="px-6 mb-6">
            <h1 className="text-3xl md:text-4xl font-bold text-center tracking-tight">
                <span className="font-extrabold text-foreground">Clinicus</span>
                <span className="font-extrabold text-primary">AI</span>
            </h1>
           </header>
          <main className="flex-grow flex justify-center items-start px-4 md:px-6">
             <div className="w-full max-w-7xl border border-border rounded-lg shadow-lg p-4 md:p-6 flex flex-col lg:flex-row gap-6 md:gap-8 bg-[#FAFAFA]">
            <div className="flex flex-col lg:w-2/3 w-full space-y-6">
                 <div className="flex flex-col md:flex-row gap-6">
                    <div className="flex flex-col md:w-1/2 w-full space-y-4">
                      <Textarea
                        placeholder="Describe how you're feeling..."
                        className="min-h-[150px] flex-grow resize-none rounded-md shadow-sm border-input focus:ring-primary focus:border-primary text-base placeholder:text-muted-foreground"
                        value={textInput}
                        onChange={(e) => setTextInput(e.target.value)}
                        aria-label="Text input for mental health analysis"
                      />

                      <div className="flex flex-col sm:flex-row items-center justify-between space-y-2 sm:space-y-0 sm:space-x-3">
                         <Button
                            variant={isRecordingVoice ? "destructive" : "outline"}
                            onClick={isRecordingVoice ? stopRecordingVoice : startRecordingVoice}
                            disabled={isLoading || isRecordingVideo}
                            className="h-12 w-full sm:flex-1 flex items-center justify-center text-base rounded-md shadow-sm border border-input hover:bg-accent hover:text-accent-foreground"
                            aria-label={isRecordingVoice ? "Stop voice recording" : "Start voice recording"}
                         >
                            {isRecordingVoice ? "Stop" : "Voice"}
                            <Mic className="ml-2 h-6 w-6" />
                         </Button>

                        <Button
                            variant={isRecordingVideo ? "destructive" : "outline"}
                            onClick={isRecordingVideo ? stopRecordingVideo : startRecordingVideo}
                            disabled={isLoading || isRecordingVoice}
                            className="h-12 w-full sm:flex-1 flex items-center justify-center text-base rounded-md shadow-sm border border-input hover:bg-accent hover:text-accent-foreground"
                            aria-label={isRecordingVideo ? "Stop video recording" : "Start video recording"}
                        >
                            {isRecordingVideo ? "Stop" : "Video"}
                          <Camera className="ml-2 h-6 w-6" />
                        </Button>
                      </div>

                      <Button
                         onClick={handleAnalyze}
                         disabled={isLoading || isRecordingVoice || isRecordingVideo}
                         className="w-full h-14 text-lg font-semibold rounded-md shadow-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                         aria-label="Analyze input"
                       >
                        {isLoading ? "Analyzing..." : "Analyze"}
                      </Button>
                    </div>

                    <div className="md:w-1/2 w-full flex flex-col space-y-4">
                        <div className={`w-full aspect-video rounded-md bg-muted flex items-center justify-center border border-dashed border-border overflow-hidden relative ${showCamera ? 'block' : 'hidden'}`}>
                            <video
                                ref={videoRef}
                                className={`w-full h-full object-cover rounded-md ${hasCameraPermission ? 'block' : 'hidden'}`}
                                autoPlay
                                muted
                                playsInline
                                aria-label="Camera preview"
                            />
                             {showCamera && !hasCameraPermission && (
                                <Alert variant="destructive" className="absolute inset-4 m-auto max-w-sm">
                                     <AlertTitle>Camera/Mic Access Needed</AlertTitle>
                                     <AlertDescription>
                                        Please allow access to use the video feature. You might need to reload the page after granting permission.
                                     </AlertDescription>
                                </Alert>
                             )}
                              {showCamera && !videoRef.current?.srcObject && hasCameraPermission && (
                                   <p className="absolute inset-0 flex items-center justify-center text-muted-foreground">Starting camera...</p>
                              )}
                         </div>
                         {!showCamera && (
                            <div className="w-full aspect-video rounded-md bg-muted border border-dashed border-border flex items-center justify-center text-muted-foreground text-center p-4">
                                Camera preview appears here when recording video
                            </div>
                          )}

                       <div className="w-full space-y-4 overflow-y-auto max-h-[calc(100vh-550px)] md:max-h-[calc(100vh-450px)] pr-2 scrollbar-thin scrollbar-thumb-border scrollbar-track-card">
                         {renderAnalysisResult("Text Analysis", lastTextAnalysis)}
                         {renderAnalysisResult("Voice Analysis", lastVoiceAnalysis)}
                         {renderAnalysisResult("Video Analysis", lastVideoAnalysis)}

                           {!isLoading && !lastTextAnalysis && !lastVoiceAnalysis && !lastVideoAnalysis && (
                            <Card className="border-dashed border-border bg-muted">
                                <CardContent className="pt-6 text-center text-muted-foreground">
                                    Analysis results will appear here. Provide input and click Analyze.
                                </CardContent>
                            </Card>
                           )}
                             {isLoading && !lastTextAnalysis && !lastVoiceAnalysis && !lastVideoAnalysis && (
                                <Card className="border-dashed border-border bg-primary/10">
                                    <CardContent className="pt-6 text-center text-primary font-semibold">
                                        Analyzing... Please wait.
                                    </CardContent>
                                </Card>
                             )}
                      </div>
                    </div>
                 </div>
            </div>

             <div className="flex flex-col lg:w-1/3 w-full space-y-4 border border-border rounded-lg p-2 md:p-4 bg-[#FAFAFA] shadow-inner min-h-[50vh] lg:min-h-0">
                <CardHeader className="p-2 border-b border-border">
                    <CardTitle className="text-lg text-center font-semibold text-black">ClinicusAI Chat</CardTitle>
                </CardHeader>
                <ScrollArea className="flex-grow h-[calc(100vh-500px)] lg:h-[calc(100vh-400px)] p-2 md:p-4" viewportRef={chatContainerRef as RefObject<HTMLDivElement>}>
                    <div className="space-y-4">
                        {chatbotHistory.map((msg, index) => (
                            <div
                                key={index}
                                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                <div
                                    className={`px-3 py-2 md:px-4 rounded-lg max-w-[80%] ${
                                        msg.role === 'user'
                                            ? 'bg-primary text-primary-foreground'
                                            : 'bg-muted text-muted-foreground'
                                    }`}
                                >
                                    {msg.text}
                                </div>
                            </div>
                        ))}
                         {isBotLoading && chatbotHistory.length > 0 && (
                            <div className="flex justify-start">
                                <div className="px-4 py-2 rounded-lg bg-muted text-muted-foreground max-w-[80%]">
                                    Thinking...
                                </div>
                            </div>
                        )}
                         {chatbotHistory.length === 0 && !isBotLoading && !isLoading &&(
                            <p className="text-center text-muted-foreground italic">
                                Chatbot will respond here. Start chatting or analyze input.
                            </p>
                         )}
                         {isLoading && (
                             <p className="text-center text-muted-foreground italic">
                                Analysis in progress... Chat available after completion.
                            </p>
                         )}
                    </div>
                </ScrollArea>
                <div className="flex items-center space-x-2 p-2 border-t border-border">
                     <Button
                        variant={isChatBotRecording ? "destructive" : "ghost"}
                        size="icon"
                        onClick={isChatBotRecording ? stopChatBotRecording : startChatBotRecording}
                        disabled={isBotLoading}
                        aria-label={isChatBotRecording ? "Stop chatbot voice input" : "Start chatbot voice input"}
                      >
                        <Mic className={`h-5 w-5 ${isChatBotRecording ? 'text-destructive-foreground' : 'text-card-foreground'}`} />
                      </Button>
                    <Input
                        type="text"
                        placeholder="Type or use mic..."
                        className="flex-grow placeholder:text-muted-foreground"
                        value={chatbotInput}
                        onChange={(e) => setChatbotInput(e.target.value)}
                        onKeyDown={handleChatInputKeyDown}
                        disabled={isBotLoading || isChatBotRecording}
                        aria-label="Chatbot input"
                    />
                    <Button
                        onClick={() => handleSendMessageToBot()}
                        disabled={isBotLoading || isChatBotRecording || !chatbotInput.trim()}
                        size="icon"
                        aria-label="Send message to chatbot"
                    >
                        <Send className="h-5 w-5" />
                    </Button>
                </div>
            </div>


          </div>
         </main>

          <footer className="flex justify-center items-center w-full p-4 mt-auto border-t border-border bg-muted">
             <div className="flex flex-wrap justify-center items-center gap-4 md:gap-8">
                 <a href="https://www.linkedin.com/in/jai-chaudhary-54bb86221" target="_blank" rel="noopener noreferrer" className="hover:opacity-80 transition-opacity text-yellow-400 hover:text-primary" aria-label="LinkedIn Profile (opens in new tab)">
                    <Linkedin className="h-8 w-8 md:h-10 md:w-10" data-ai-hint="linkedin logo" />
                 </a>
                 <a href="https://github.com/jcb03" target="_blank" rel="noopener noreferrer" className="hover:opacity-80 transition-opacity text-yellow-400 hover:text-primary" aria-label="GitHub Profile (opens in new tab)">
                    <Github className="h-8 w-8 md:h-10 md:w-10" data-ai-hint="github logo" />
                 </a>
                 <a href="mailto:jaichaudhary0303@gmail.com" className="hover:opacity-80 transition-opacity text-yellow-400 hover:text-primary" aria-label="Send email to jaichaudhary0303@gmail.com">
                    <GmailIcon className="h-8 w-8 md:h-10 md:w-10" data-ai-hint="gmail logo" />
                 </a>
                 <a href="https://learn.microsoft.com/en-us/users/jaichaudhary-6371/" target="_blank" rel="noopener noreferrer" className="hover:opacity-80 transition-opacity text-yellow-400 hover:text-primary" aria-label="Microsoft Learn Profile (opens in new tab)">
                    <MicrosoftIcon className="h-8 w-8 md:h-10 md:w-10" data-ai-hint="microsoft logo" />
                 </a>
                 <a href="https://www.coursera.org/user/2e5b8a240f4037ecbe9428660cecf7bd" target="_blank" rel="noopener noreferrer" className="hover:opacity-80 transition-opacity text-yellow-400 hover:text-primary" aria-label="Coursera Profile (opens in new tab)">
                    <CourseraIcon className="h-8 w-8 md:h-10 md:w-10" data-ai-hint="coursera logo" />
                </a>
             </div>
          </footer>
        </div>
      </div>
    </SidebarProvider>
  );
}

const ConditionalSidebarHeaderTitle = () => {
  const { open, isMobile } = useSidebar(); 
  // On desktop, the sidebar is always "open" conceptually, so we always show the title.
  // On mobile, it depends on the sheet state.
  const shouldShowTitle = !isMobile || open;

  return shouldShowTitle ? (
    <h2 className="text-lg font-bold tracking-tight ml-2 text-sidebar-foreground">Chat History</h2>
  ) : null;
};

