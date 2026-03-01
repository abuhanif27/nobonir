import subprocess
import time
import sys
import os

def start_backend():
    print("Starting Backend...")
    backend_env = os.environ.copy()
    backend_env["PYTHONPATH"] = os.path.join(os.getcwd(), "backend")
    
    return subprocess.Popen(
        [sys.executable, "backend/manage.py", "runserver", "127.0.0.1:8000", "--noreload"],
        env=backend_env
    )

def start_frontend():
    print("Starting Frontend...")
    frontend_dir = os.path.join(os.getcwd(), "frontend")
    
    # Check for npm command on Windows
    npm_cmd = "npm.cmd" if os.name == "nt" else "npm"
    
    return subprocess.Popen(
        [npm_cmd, "run", "dev", "--", "--host", "127.0.0.1"],
        cwd=frontend_dir
    )

def main():
    print("Nobonir Unified Runner")
    print("-" * 20)
    
    backend_proc = None
    frontend_proc = None
    
    try:
        backend_proc = start_backend()
        frontend_proc = start_frontend()
        
        print("\nServices are running!")
        print("Backend: http://127.0.0.1:8000/")
        print("Frontend: http://127.0.0.1:5173/")
        print("-" * 20)
        print("Press Ctrl+C to stop both.")
        
        while True:
            # Check if any process has exited
            if backend_proc.poll() is not None:
                print(f"Backend exited with code {backend_proc.returncode}")
                break
            if frontend_proc.poll() is not None:
                print(f"Frontend exited with code {frontend_proc.returncode}")
                break
            time.sleep(1)
            
    except KeyboardInterrupt:
        print("\nStopping services...")
    except Exception as e:
        print(f"\nAn error occurred: {e}")
    finally:
        if backend_proc:
            backend_proc.terminate()
            print("Backend terminated.")
        if frontend_proc:
            frontend_proc.terminate()
            print("Frontend terminated.")
            
if __name__ == "__main__":
    main()
