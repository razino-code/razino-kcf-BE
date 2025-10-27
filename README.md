# 라즈이노 | 독거노인 원터치 통화 시스템

### 개요
라즈이노는 독거노인의 고독사 방지 및 가족 간 원활한 소통을 목적로 한 IoT 기반 원터치 통화 시스템이다.  
사용자(보호자)가 스마트폰으로 통화를 걸면 벽면에 설치된 라즈베리파이 모니터에 통신이 와서 가족과 화상통화를
하게 만들었고 거동이 어렵거나 스마트폰의 사용이 어려운 노인분들이 쉽게 사용할 수 있게 설계 되어있다.

### 사용 기술

- webRTC /  실시간 영상·음성 데이터 송수신  
- Express /  서버 및 라우팅 관리  
- ejs / 모바일·라즈베리 UI 분리 및 디자인
- Raspberry Pi /  IoT 하드웨어 플랫폼  


### 작동 로직

server.js
├── /mobile (mobile_index.ejs)
│ └── /mobileCall (mobile.ejs)
└── /raspberry (raspberrypi_index.ejs)
└── /raspberryCall (raspberry.ejs)
