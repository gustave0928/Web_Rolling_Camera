const Mode = {
  ALL: 'all',
  NIGHT: 'night',
  CITY: 'city',
  BEACH: 'beach',
  MOUNTAIN: 'mountain',
  LANDMARK: 'landmark',
  FUJI: 'fuji',
  NATURE: 'nature',
};

let changeTimeout;
let youtubePlayer;
// let audioPlayer;
let videoObj;
let audioObj;
// let audioPlayerReady = false;
let videoPlayerReady = false;

// 초기 설정
let currentMode = getCurrentMode();
let videoMode = Mode.ALL; // video_mode 초기 설정
let nightMode = true; // night_mode 초기 설정
let playlistData;
let isInit = true;
let shouldStopTimer = false;
let isTimerPaused = false; // 타이머 정지 상태 여부
let isSunCalLoaded = false;
let hideButtonTimeout;
let countdownTimer;
let playlistState = 0;
let audioPlaylistData;
let videoPlaylistData; // Array to store video playlist data
let currentAudioIndex = 0; // Current index for audio playback
let currentVideoIndex = 0; // Current index for video playback
let playedVideos = new Set(); // 이미 재생된 비디오의 인덱스를 저장하는 Set

// DOM 요소
const playerElement = document.getElementById('youtubePlayer');
const countdownDisplay = document.getElementById('remaining-time');
const titleElement = document.getElementById('title');
const addressElement = document.getElementById('address');
const riseElement = document.getElementById('rise');
const setElement = document.getElementById('set');
const riseIconElement = document.getElementById('rise-icon');
const setIconElement = document.getElementById('set-icon');

// SunCalc 로드 여부를 확인하는 함수
function initializeSunCalc(retryCount = 5) {
  if (typeof SunCalc !== 'undefined') {
      console.log('SunCalc 라이브러리 로드 완료.');

      isSunCalLoaded = true;    
  } else if (retryCount > 0) {
      console.warn(`SunCalc 라이브러리가 로드되지 않았습니다. ${6 - retryCount}/5 재시도 중...`);
      setTimeout(() => initializeSunCalc(retryCount - 1), 500); // 500ms 후에 다시 시도
  } else {
      console.error('SunCalc 라이브러리 로드에 실패했습니다. 페이지를 새로고침 해주세요.');
  }
}

window.onload = function() {
  initializeSunCalc();
};

// YouTube iframe API 스크립트 삽입
insertScript('https://www.youtube.com/iframe_api');

// 이벤트 리스너 등록
document.addEventListener('keydown', handleKeyPress);

// Load all necessary JSON data before proceeding
async function initializePlayers() {
  try {
    await readVideoPlayList(); // this will also load the audio playlist
    // await readAudioPlayList();

    // Check if all necessary data is loaded    
    console.log('Video playlists loaded, setting up players.');
    // Setup the players
    initYouTubePlayers();
  } catch (error) {
    console.error('Failed to initialize players:', error);
  }
}

// Call the initialization function
initializePlayers();

// 한 시간마다 재생 목록 갱신
setInterval(readVideoPlayList, 3600000);
// setInterval(readAudioPlayList, 3600000);

// ### Load JSON with Cache Busting ###
function loadJSONFileWithCacheBusting(url) {
  const cacheBustedUrl = `${url}?t=${new Date().getTime()}`; // Append timestamp to URL
  return fetch(cacheBustedUrl)
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .catch(error => {
      console.error(`Failed to load ${url}:`, error);
    });
}

// 현재 모드 가져오기
function getCurrentMode() {
  const currentHour = new Date().getHours();
  return currentHour >= 18 || currentHour < 6 ? Mode.NIGHT : Mode.ALL;
}

async function readVideoPlayList() {
  try {
    const data = await loadJSONFileWithCacheBusting('youtube_video.json'); // Load the JSON file
    videoPlaylistData = data;
    console.log('Video playlist data loaded:', videoPlaylistData);
  } catch (error) {
    console.error('Failed to load playlists:', error);
  }
}

// 오디오 및 비디오 재생 목록 로드
// async function readAudioPlayList() {
//   try {
//     const data = await loadJSONFileWithCacheBusting('youtube_audio.json'); // Load the JSON file
//     audioPlaylistData = data;
//     console.log('Audio playlist data loaded:', audioPlaylistData);
//   } catch (error) {
//     console.error('Failed to load playlists:', error);
//   }
// }

// YouTube iframe API가 준비되었을 때 호출
function onYouTubeIframeAPIReady() {
  console.log('YouTube Iframe API is ready.');
  initYouTubePlayers();
}

// Initialize YouTube Players after JSON data is loaded
function initYouTubePlayers() {
  youtubePlayer = new YT.Player('youtubePlayer', {
    playerVars: {
      autoplay: 1,
      controls: 0,
      showinfo: 1,
      modestbranding: 1,
      rel: 0,
      iv_load_policy: 3,
      fs: 0,
      mute: 1,
      enablejsapi: 1,
      disablekb: 1
    },
    events: {
      onReady: onPlayerReady,
      onStateChange: onPlayerStateChange,
      onError: onPlayerError,
      onPlaybackQualityChange: onPlayerPlaybackQualityChange
    }
  });

  // audioPlayer = new YT.Player('audioPlayer', {
  //   height: '50',
  //   width: '50',
  //   videoId: 'eG7vmbHA048', // Default video ID
  //   playerVars: {
  //       autoplay: 1,
  //       controls: 0,        
  //       mute: 0,
  //       enablejsapi: 1,
  //       disablekb: 1
  //   },
  //   events: {
  //     onReady: onAudioPlayerReady,
  //     onStateChange: onAudioPlayerStateChange,
  //     onError: onAudioPlayerError
  //   }
  // });
}

// 플레이어 준비 완료 이벤트
function onPlayerReady(event) {
  console.log('YouTube Player is ready.');
  videoPlayerReady = true;

  function tryPlayNextVideo(retryCount = 5) {
      if (retryCount <= 0) {
        console.error('Failed to initialize YouTube Player after multiple attempts.');
        // 자동 새로고침 안내 메시지 표시
        alert('Youtube player 로드에 실패했습니다. 2초 뒤에 페이지 새로고침을 합니다.');
        setTimeout(() => {
            location.reload(); // 2초 후에 페이지 자동 새로고침
        }, 2000);
        return;
      }

      if (typeof youtubePlayer.loadVideoById === 'function') {
          console.log('youtubePlayer.loadVideoById is available, proceeding to play next video.');
          playNextVideo();  // 데이터가 로드된 후에만 재생 시작
      } else {
          console.warn(`loadVideoById is not available yet, retrying... (${6 - retryCount}/5)`);
          setTimeout(() => tryPlayNextVideo(retryCount - 1), 500); // 200ms 후에 다시 시도
      }
  }

  if (videoPlaylistData && videoPlaylistData.length > 0) {
      event.target.setShuffle(true);
      event.target.setLoop(true);
      event.target.setPlaybackQuality('highres'); // Set to highres quality for video
      tryPlayNextVideo();  // 재시도 로직을 포함한 함수 호출
  }
}

// 오디오 플레이어 준비 완료 이벤트
// function onAudioPlayerReady(event) {
//     console.log('Audio Player is ready.');
//     audioPlayerReady = true;

//     if (audioPlaylistData && audioPlaylistData.length > 0) {
//         event.target.playVideo();
//         event.target.setLoop(true);
//         playNextAudio();  // 데이터가 로드된 후에만 재생 시작
//     }
// }
  

// 재생 품질 변경 이벤트
function onPlayerPlaybackQualityChange(event) {
  console.log('Playback quality changed to:', event.data);
  if (event.target === youtubePlayer && (event.data === 'medium' || event.data === 'small' || event.data === 'tiny')) {
    console.warn('Playback quality is too low, setting to highres.');
    event.target.setPlaybackQuality('highres');
  } 
  // else if (event.target === audioPlayer && event.data !== 'small') {
  //   console.warn('Audio playback quality is not small, setting to small.');
  //   event.target.setPlaybackQuality('small');
  // }
}

// 플레이어 상태 변경 이벤트
function onPlayerStateChange(event) {
  console.log('Player state changed to:', event.data);
  if (event.data === YT.PlayerState.ENDED) {
    if (event.target === youtubePlayer) {
      playNextVideo(); // Play next video when the current one ends
    } 
    // else if (event.target === audioPlayer) {
    //   playNextAudio(); // Play next audio when the current one ends
    // }
  }
}

// 오디오 플레이어 상태 변경 이벤트
// function onAudioPlayerStateChange(event) {
//   console.log('Audio Player state changed to:', event.data);
//   if (event.data === YT.PlayerState.ENDED) {
//     playNextAudio(); // Play next audio when the current one ends
//   } 
// }

// 플레이어 오류 이벤트
function onPlayerError(event) {
  console.error('Player error occurred:', event.data);
  if (event.data === 100 || event.data === 101 || event.data === 150 || event.data === 2) {
    console.error('YouTube Player error, playing next video.');
    if (videoPlaylistData && videoPlaylistData.length > 0) {
        playNextVideo();
    }
  }
}

// function onAudioPlayerError(event) {
//     console.error('AudioPlayer error occurred:', event.data);
//     if (event.data === 100 || event.data === 101 || event.data === 150 || event.data === 2) {
//       console.error('YouTube Player error, playing next audio.');
//       if (audioPlaylistData && audioPlaylistData.length > 0) {
//         playNextAudio();  
//       }
//     }
// }  

// function playNextAudio() {
//     console.log('Playing next audio. audioPlayerReady:', audioPlayerReady);
//     if(!audioPlayerReady)   return;
//     const now = new Date();
//     const isNightTime =
//         (now.getHours() > 16 && now.getMinutes() >= 30) ||
//         now.getHours() < 7 ||
//         (now.getHours() === 16 && now.getMinutes() === 30);

//     let filteredPlaylist = audioPlaylistData;
//     if (isNightTime) {
//         filteredPlaylist = filteredPlaylist.filter(item => item.night_view === true);
//     }

//     console.log('filteredPlaylist length:', filteredPlaylist.length);

//      if (filteredPlaylist.length > 0) {
//         const randomIndex = getRandomIndex(filteredPlaylist.length);
        
//         audioObj = filteredPlaylist[randomIndex];
//         console.log('randomIndex:', randomIndex, ' / audio_id:', audioObj.audio_id);
//         audioPlayer.loadVideoById(audioObj.audio_id);
//         audioPlayer.setPlaybackQuality('small');
//         audioPlayer.playVideo();
//     }
// }

// 다음 비디오 재생
async function playNextVideo() {
  console.log('Playing next video.');
  if (!videoPlayerReady) return;
  stopCountdown();

  currentMode = getCurrentMode();
  console.log('Current mode:', currentMode);

  let filteredPlaylist = [];

  for (const video of videoPlaylistData) {
      const videoTime = new Date().toLocaleString("en-US", { timeZone: video.time_zone });
      const videoHour = new Date(videoTime).getHours();

      const isVideoNightTime = videoHour > 16 || videoHour < 7;

      // 조건 1: night_mode가 켜져 있고, 비디오 시간이 밤인지 확인
      // 조건 2: video_mode와 일치하는 비디오만 재생
      if (
          (!nightMode || (nightMode && isVideoNightTime && video.night_view)) && 
          (videoMode === Mode.ALL || video.video_mode === videoMode)
      ) {
          filteredPlaylist.push(video);
      }
  }

  console.log('Filtered playlist length:', filteredPlaylist.length);

  // 모든 비디오가 재생되었을 경우, playedVideos 초기화
  if (playedVideos.size === filteredPlaylist.length) {
      console.log('All videos have been played. Resetting played videos.');
      playedVideos.clear();
  }

  // 아직 재생되지 않은 비디오 필터링
  const unplayedVideos = filteredPlaylist.filter((_, index) => !playedVideos.has(index));

  if (unplayedVideos.length > 0) {
      const randomIndex = getRandomIndex(unplayedVideos.length);
      const selectedVideoIndex = filteredPlaylist.indexOf(unplayedVideos[randomIndex]);
      console.log('Selected video index:', selectedVideoIndex);
      playedVideos.add(selectedVideoIndex); // 선택된 비디오 인덱스를 기록

      videoObj = unplayedVideos[randomIndex];

      if(isSunCalLoaded) {
        
        const weatherCity = videoObj.weather_city;
        if (isNaN(parseInt(weatherCity.charAt(0)))) {          
          console.log('Invalid weather city:', weatherCity);
          // 이미지 요소를 숨김
          riseIconElement.style.display = 'none';
          setIconElement.style.display = 'none';
        } else {
          const [latitude, longitude] = weatherCity.split(", ").map(Number);
  
          // 현재 날짜와 위치를 기반으로 일출 및 일몰 시간 계산
          const times = SunCalc.getTimes(new Date(), latitude, longitude);
  
          // 계산된 일출 및 일몰 시간
          const sunrise = times.sunrise;
          const sunset = times.sunset;
  
          // 일출 및 일몰 시간을 현지 시간대로 변환하여 표시
          const sunriseStr = sunrise.toLocaleTimeString('en-US', {
              timeZone: videoObj.time_zone,
              hour: '2-digit',
              minute: '2-digit',
              hour12: true  // AM/PM 형식 사용
          });
          
          const sunsetStr = sunset.toLocaleTimeString('en-US', {
              timeZone: videoObj.time_zone,
              hour: '2-digit',
              minute: '2-digit',
              hour12: true  // AM/PM 형식 사용
          });
  
          console.log(`일출 시간: ${sunriseStr}`);
          console.log(`일몰 시간: ${sunsetStr}`);

          riseElement.textContent = sunriseStr;
          setElement.textContent = sunsetStr;

          riseIconElement.src = 'img/sunrise.png';
          setIconElement.src = 'img/sunset.png';

          riseIconElement.style.display = 'block';
          setIconElement.style.display = 'block';
        }
      } else {
        // 이미지 요소를 숨김
        riseIconElement.style.display = 'none';
        setIconElement.style.display = 'none';
      }

      // try {
      //   const data = await fetchWeatherData(videoObj.weather_city);
      //   updateWeatherInfo(data);
      // } catch (err) {
      //   console.error('Failed to fetch weather data:', err);
      // }

      console.log('videoObj video_id:', videoObj.video_id);    
      if (youtubePlayer && typeof youtubePlayer.loadVideoById === 'function') {
          console.log('youtubePlayer is ready and loadVideoById is a function');
          youtubePlayer.loadVideoById(videoObj.video_id);
          youtubePlayer.setPlaybackQuality('highres'); // Set to highres quality for video
          youtubePlayer.playVideo();
      } else {
          console.error('youtubePlayer is not ready or loadVideoById is not a function');
          return;
      }
      titleElement.innerText = videoObj.title;
      addressElement.innerText = videoObj.address;
  } else {
      console.log('No unplayed videos left.');
  }

  if (!isTimerPaused) {
    startCountdown();
  }
  toggleBackgroundColor();
}

// 배경색 토글
function toggleBackgroundColor() {
  setTimeout(() => {
    const elements = [countdownDisplay, titleElement, addressElement];
    elements.forEach(el => (el.style.backgroundColor = 'rgba(0, 0, 0, 0.6)'));
    setTimeout(() => {
      elements.forEach(el => (el.style.backgroundColor = 'transparent'));
    }, 4000);
  }, 100);
}

// 카운트다운 시작
function startCountdown() {
    console.log('Countdown started.');

    // 기존 타이머가 있으면 실행하지 않도록 방지
    if (countdownTimer) return;
    console.log('Countdown started. #1');
    let countdown = 60;

    // 비디오 객체의 타임존 시간 계산
    const videoTime = new Date().toLocaleString("en-US", { timeZone: videoObj.time_zone });
    const videoTimeDate = new Date(videoTime);
    
    // PC 시간 계산
    const pcTime = new Date();
    
    // 시차 계산 (시간 단위로)
    const timeDifferenceHours = Math.round((videoTimeDate - pcTime) / (1000 * 60 * 60)); // 시간 단위로 계산

    // AM/PM 표시
    const ampm = videoTimeDate.getHours() >= 12 ? 'PM' : 'AM';

    countdownTimer = setInterval(() => {
        countdown--;

        // 시차가 있을 경우만 "Time diff"를 표시
        const timeDiffText = timeDifferenceHours !== 0 ? `, Time diff: ${timeDifferenceHours} hrs` : '';

        countdownDisplay.innerText = `${ampm} ${formatTime12H(videoTimeDate)}${timeDiffText} (Until Next Video Starts: ${countdown} sec)`;

        if (countdown <= 0) {
            clearInterval(countdownTimer);
            countdownTimer = null; // 타이머를 정리하고 null로 초기화
            countdownDisplay.innerText = 'Loading...';
            playNextVideo();
        }
    }, 1000);
}

// 카운트다운 정지
function stopCountdown() {
  console.log('Countdown stopped.');
  if (countdownTimer) {
      console.log('Countdown stopped.');
      clearInterval(countdownTimer);
      countdownTimer = null;
      countdownDisplay.innerText = 'Timer stopped.';
  }
}

// 12시간제 시간 포맷 변환 함수
function formatTime12H(date) {
    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');

    hours = hours % 12;
    hours = hours ? hours : 12; // 0시를 12시로 표시
    return `${hours}:${minutes}`;
}


// 키 프레스 핸들러
function handleKeyPress(event) {
  switch (event.key) {
    case 'ArrowRight':
    case 'ArrowLeft':
      if (isTimerPaused) {
        resumeTimer();
      } else {
        playNextVideo();
        stopCountdown();  // 기존 타이머가 있을 경우 정지
        startCountdown(); // 타이머 재시작
      }
      break;
    case 'ArrowUp':   // video_mode 변경
      changeVideoMode();
      break;
    case 'ArrowDown': // night_mode on/off
      toggleNightMode();
      break;
    case 'Enter':   // Enter key
    case ' ':       // space key
    case 'OK':      // LG TV remote OK button
      event.preventDefault();
      if (isTimerPaused) {
        resumeTimer();
      } else {
        pauseTimer();
      }
      break;
  }
}

// 안내 문구를 표시하고 일정 시간 후에 숨기는 함수
function showNotification(message) {
  const notificationElement = document.getElementById('notification');
  notificationElement.innerText = message;
  notificationElement.style.display = 'block';
  
  // 3초 후 안내 문구 숨기기
  setTimeout(() => {
      notificationElement.style.display = 'none';
  }, 3000);
}


// video_mode 변경 함수
function changeVideoMode() {
  const modes = [Mode.ALL, Mode.BEACH, Mode.CITY, Mode.MOUNTAIN, Mode.LANDMARK, Mode.FUJI, Mode.NATURE];
  let currentIndex = modes.indexOf(videoMode);
  videoMode = modes[(currentIndex + 1) % modes.length];
  console.log('Video mode changed to:', videoMode);
  // 안내 문구 표시
  showNotification(`Video mode: ${videoMode}`);
  playNextVideo(); // 변경된 모드에 따라 다음 비디오 재생
}

// night_mode 토글 함수
function toggleNightMode() {
  nightMode = !nightMode;
  console.log('Night mode is now:', nightMode ? 'ON' : 'OFF');
  // 안내 문구 표시
  showNotification(`Night mode: ${nightMode ? 'ON' : 'OFF'}`);
  playNextVideo(); // 변경된 모드에 따라 다음 비디오 재생
}

// 타이머 일시정지
function pauseTimer() {
  console.log('Timer paused.');
  isTimerPaused = true;
  stopCountdown();
  countdownDisplay.style.display = 'none'; // 타이머 숨기기
}

// 타이머 재개
function resumeTimer() {
  console.log('Timer resumed.');
  isTimerPaused = false;
  countdownDisplay.style.display = 'block'; // 타이머 표시
  startCountdown();
}

// 스크립트 삽입
function insertScript(src) {
  const script = document.createElement('script');
  script.src = src;
  document.head.appendChild(script);
}

// 랜덤 인덱스 생성
function getRandomIndex(max) {
  return Math.floor(Math.random() * max);
}
