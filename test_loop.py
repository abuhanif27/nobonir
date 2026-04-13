import time
import sys

def main():
    print("Python loop starting...")
    sys.stdout.flush()

    i = 0
    while True:
        print(f"Loop {i}")
        sys.stdout.flush()
        i += 1
        time.sleep(1)


if __name__ == "__main__":
    main()
