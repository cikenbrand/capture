# Application Flow

- App Launch
  - Start application and immediately show the Splash Screen.
  - Splash Screen stays visible until all checks are complete.

- Check OBS Process
  - Run `checkIfObsIsOpenOrNot` to see if OBS is running.
  - If OBS is not running:
    - Call `openObs` to launch OBS.
    - Wait until OBS is confirmed to be open.
  - If OBS is already running:
    - Skip launching, proceed directly to WebSocket connection.

- Connect to OBS WebSocket
  - Call `connectToObsWebsocket` to establish a connection.
  - If connection fails, remain on Splash Screen until it succeeds.

- Open Main Window
  - Once OBS WebSocket connection is successful:
    - Close the Splash Screen.
    - Show the Main Window.
    - Application is now ready for user interaction.

- App Exit
  - When the application is closing:
    - Call `exitObs` to cleanly shut down the OBS process **only if it was started by the app**.
    - If OBS was already running before app launch, leave it open.
    - Then quit the application.

---

## Flow Summary
1. Open Splash Screen  
2. Check if OBS is running  
   - If not → launch OBS, then wait until ready  
   - If already running → skip launch  
3. Connect to OBS WebSocket  
   - Stay on splash until connected  
4. Close Splash Screen and show Main Window  
5. On App Exit → run `exitObs` (only if OBS was launched by the app) before quitting