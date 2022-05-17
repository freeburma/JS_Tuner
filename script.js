/*
The MIT License (MIT)

Author 1: Copyright (c) 2022 - FreeBurma
FreeBurma Copyright rules: 

If you are using this source code in Your Projects including 
development, digital and electronic publication must include my GitHub repo links 
and Author 2 copyright declaration. 


THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

==================================================================================
==================================================================================
Author 2:  Copyright (c) 2014 Chris Wilson 
Chris Wilson copyright declaration as follow. 

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
console.log('JS Loaded ...');
window.AudioContext = window.AudioContext || window.webkitAudioContext; 

//// Declaring Variables for UI
let dial, noteValue, circle, Tune, natural, flat, sharp = null; 
let lastNoteValue = null; 


//// Declaring Variables for Audio Context 
let audioContext = null; 
let analyser = null; 
let mediaStreamSource = null; 

let MAX_SIZE = 0; 

let rafID = null; 
let buflen = 2048; 
let buf = new Float32Array(buflen);
let isMove = false; 



// \u266f: Unicode Char for Sharp sign 
// \u266D: Unicode Char for Flat sign

let noteStrings = ["C", "C\u266f", "D", "E\u266D", "E", "F", "F\u266f", "G", "G\u266f", "A", "B\u266D", "B"]; 

window.onload = function() 
{
    audioContext = new AudioContext(); 
    analyser = audioContext.createAnalyser(); 

    dial = document.querySelector('.dial'); 
    noteValue = document.querySelector('.NoteValue'); 

    //// Creating Audio Context 
    // MAX_SIZE = Math.max(4, Math.floor(audioContext.sampleRate / 5000)); // Corresponds to a 5kHZ signal

    MicInput(); // Initializing the 

};// end window.onload()


function MicInput()
{
   
   
    //// Setting up audio 
    getUserMedia(
        {
            "audio": 
            {
                mandatory: 
                {
                    "googEchoCancellation": "false",
                    "googAutoGainControl": "false",
                    "googNoiseSuppression": "false",
                    "googHighpassFilter": "false"
                }, 
                "optional": []
            },
        }, goStream); 

    // updatePitch(); 
}// end LiveInput()

////==================================================================================
//// The following codes are copied from PitchDetect, GitHub source. 
//// I gave full credit to author to accomplish my project without using too much research. 
//// If you want to see the original source code, please go to the following link. 
//// Source Code: https://github.com/cwilso/PitchDetect
////==================================================================================


function error() 
{
    alert('Stream generation failed.');
}// end error()

function getUserMedia(dictionary, callback)
{
    try 
    {
        navigator.getUserMedia = navigator.getUserMedia || 
                                    navigator.webkitGetUserMedia || 
                                    navigator.mozGetUserMedia; 

        navigator.getUserMedia(dictionary, callback, error); 

    }
    catch(e)
    {
        alert('getUserMedia threw exception :' + e);
    }// end try - catch()

}// end getUserMedia()

function goStream(stream) 
{

    //// Create an AudioNode from the stream 
    mediaStreamSource = audioContext.createMediaStreamSource(stream); 

    //// Connect it to the destination 
    analyser.fftSize = 2048; 

    mediaStreamSource.connect(analyser); 

    console.log(analyser);

    //// Updating Pitch
    updatePitch(); 

}// end goStream()




function updatePitch()
{
    
    console.log("====================================================================");
    let getFloatTimeDomainData = analyser.getFloatTimeDomainData(buf); // Getting the audio data and store it in Buf Array

    let ac = autoCorrelate(buf, audioContext.sampleRate);              // Converting audio data to Hz
    ac = ac.toFixed(2);                                                // Rounding to 2 Decimal Places to reduce UI Exhaust

    // console.log("[ac]", ac);

    //// Detecting the tune. "ac": is accuracy 
    // if (ac != -1) // Detect the tune
    if ( ac >= 123.47 && ac <= 3951.07) // Our tuner start to detect from C3 and C8 interval to reduce noise. 
    {
      
        let pitch = ac; 

        //// Getting the pitch 
        // console.log("[Pitch] : ", pitch); 

        //// Getting node value 
        let note = noteFromPitch(pitch); // Getting note from "noteFromPitch()"
        let singleNoteValue = noteStrings[note % 12]; // Getting all 12 nodes from the array

        //// Update only when we receive only new node value 
        // if (lastNoteValue != singleNoteValue)
        // {
        //     DisplayNote(singleNoteValue); 
        //     lastNoteValue = singleNoteValue; 
        // }// end if

        DisplayNote(singleNoteValue); 


        // console.log("[Note] : ", singleNoteValue, " => ", lastNoteValue);

        let detune = centsOffFromPitch(pitch, note); // Getting cents range between -50 to +50

        if (detune == 0) // Left this one to be easier for the newbies 
        {
            console.log('[++] TUNED @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@');
        }
        else 
        {
            //// TODO: categorizing the Flat and Sharp 
            //// 1.8 is coming from if 50cents scale. Our transform range is at 90 units scale. 
            //// If you scale down 90 to 50 scales interval, we have to do 90/50=1.8
            //// 
            //// Accuracy is between +/- 3 cents with low value mic. 
            //// The distance and loudness are matter when you tune your instrument. 
            ////

            if (detune < 0) // Flat
            {
            //    console.log("[-] flat"); // Flat
               detune += 3; 
               
            }
            else            // Sharp
            {
            //    console.log("[+] sharp"); // sharp
                detune -= 3; 

            }// end if 


            // console.log("[centsVal]", detune);

        }// end if -> detune


        DialMoveByDegree(((detune) * 1.8) );        // Moving the dial according to Cent value

        SetGreenColorForTune(detune, isMove=true);  // Setting color to GREEN for Tune or near Tune

        
    }
    else  // No tune or Tune is below C3 interval
    {
        // console.log('[-] Error: Can not detect the tune');

        // Resetting UI 
        DialMoveByDegree(-90); 
        DisplayNote("--"); 


        SetGreenColorForTune(-90, isMove=false);


    }// end if 


    // console.log("====================================================================\n");

    
    // //// This is loading - "updatePitch()" forever. 
    // if ( ! window.requestAnimationFrame)
    // {
    //     window.requestAnimationFrame = window.webkitRequestAnimationFrame; 
    // }// end if 

    // rafID = window.requestAnimationFrame(updatePitch); 
}// end updatePitch()


//// Looking for new Audio data in every 500ms. 
setInterval(() => 
{
    updatePitch(); 
}, 1000/2); 


function autoCorrelate(buf, sampleRate)
{
	// Implements the ACF2+ algorithm
    let SIZE = buf.length; 
    let rms = 0; 

    for (let i = 0; i < SIZE; i++)
    {
        let val = buf[i]; 
        rms += val * val; 
    }// end for 

    rms = Math.sqrt(rms / SIZE); 

    if (rms < 0.01) // not enough signal
		return -1;

    let r1 = 0, r2 = SIZE - 1, thres = 0.2; // What is "r" variable 

    for (let i = 0; i < SIZE / 2; i++)
    {
        if (Math.abs(buf[i]) < thres)
        {
            r1 = i; 
            break; 
        }
    }// end for 

    for (let i = 1; i < SIZE / 2; i++)
    {
        if (Math.abs(buf[SIZE - i]) < thres)
        {
            r2 = SIZE - i; 
            break; 
        }
    }// end for 

    buf = buf.slice(r1, r2); 
    SIZE = buf.length; 

    let c = new Array(SIZE).fill(0); 

    for (let i = 0; i < SIZE; i++)
    {
        for (let j = 0; j < SIZE - i; j++)
        {
            c[i] = c[i] + buf[j] * buf[j + i]; 
        }// end for 
    }// end for 

    let d = 0; 

    while (c[d] > c[d + 1]) d++; // end while 

    let maxval = -1, maxpos = -1; 

    for (let i = d; i < SIZE; i++)
    {
        if (c[i] > maxval)
        {
            maxval = c[i]; 
            maxpos = i; 
        }// end if
    }// end for 

    var T0 = maxpos; 

    let x1 = c[T0 - 1], x2 = c[T0], x3 = c[T0 + 1]; 
    let a = (x1 + x3 - 2 * x2) / 2; 
    let b = (x3 - x1) / 2; 

    if (a)
    {
        T0 = T0 - b / (2 * a); 
    }// end if 


    return sampleRate / T0; 

}// end autoCorrelate()

/*
    noteFromPitch() 
    Converts the frequency to note values. 
*/
function noteFromPitch(frequency) // Have seen this on "WebAduio Course on FutureLearn"
{
    let noteNum = 12 * (Math.log(frequency / 440) / Math.log(2)); 

    return Math.round(noteNum) + 69; 
}// end noteFromPitch()

/*
    frequencyFromNoteNumber() 
    Calculates the Frequency(Hz) to Note Numbers - Standard is 440Hz
*/
function frequencyFromNoteNumber(note)
{
    return 440 * Math.pow(2, (note - 69) / 12); 
}// end frequencyFromNoteNumber()

/*
    centsOffFromPitch()
    Calculates the cents from frequency (Hz) and getting the cents values between -50 and +50 yet. 
*/
function centsOffFromPitch(frequency, note)
{
    return Math.floor(1200 * Math.log(frequency / frequencyFromNoteNumber(note)) / Math.log(2)); 
}

/*
    DialMoveByDegree() 
    Move the Dial(meter) according to degree on UI
*/
function DialMoveByDegree(degree)
{
    dial.style.transform = `rotate(${degree}deg)`; 
    // dial.style.transitionDelay = `0.0375s`; 

}// end DialMoveByDegree()

/*
    DisplayNote(): Displaying notes on UI
*/
function DisplayNote(noteVal)
{
    noteValue.innerHTML = noteVal; // Displaying Note on UI
}

/*
    SetGreenColorForTune(): will change the background color according to cent value. 
    Green: Tune 
    Sharp/Flat: Red (Under/Over from Standard Tune)

*/
function SetGreenColorForTune(detune, isMove=false)
{
    circle = document.querySelector('.circle'); 
    dial = document.querySelector('.dial'); 
    Tune = document.querySelector('.Tune'); 
    natural = document.querySelector('.natural'); 

    flat = document.querySelector('.flat'); 
    sharp = document.querySelector('.sharp'); 


    //// Resetting the background colors 
    //// Showing the red background on FLat or Sharp
    if (detune >= 0 && detune <= 3)
    {
        circle.classList.add('active'); 
        dial.classList.add('active'); 
        Tune.classList.add('active'); 
        natural.classList.add('active'); 
    
        flat.classList.remove('active'); 
        sharp.classList.remove('active'); 
    }
    else 
    {
        circle.classList.remove('active'); 
        dial.classList.remove('active'); 
        Tune.classList.remove('active'); 
        natural.classList.remove('active'); 

        if (detune < 0)
        {
            flat.classList.add('active'); 
            sharp.classList.remove('active'); 
        }
        else
        {
            flat.classList.remove('active'); 
            sharp.classList.add('active'); 
        }// end if 

        if ( isMove == false ) // Removing the flat and sharp background if dial is not moving
        {
            flat.classList.remove('active'); 
            sharp.classList.remove('active'); 

        }// end if 

    }// end if 

    
}// end SetGreenColorForTune()


