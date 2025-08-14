#!/usr/bin/env python3
"""
AI Education Platform - Test Runner
Runs all AI-related tests with proper reporting
"""

import subprocess
import sys
import os
import time
from datetime import datetime

def print_banner():
    """Print test runner banner"""
    print("🚀 AI Education Platform - Test Runner")
    print("=" * 60)
    print(f"📅 Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

def run_command(cmd, description):
    """Run a command and return the result"""
    print(f"\n🧪 {description}")
    print("-" * len(description))
    
    start_time = time.time()
    
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=300  # 5 minute timeout
        )
        
        duration = time.time() - start_time
        
        if result.returncode == 0:
            print(f"✅ PASSED ({duration:.1f}s)")
            return True
        else:
            print(f"❌ FAILED ({duration:.1f}s)")
            print("STDOUT:", result.stdout[-500:])  # Last 500 chars
            print("STDERR:", result.stderr[-500:])  # Last 500 chars
            return False
            
    except subprocess.TimeoutExpired:
        duration = time.time() - start_time
        print(f"⏰ TIMEOUT ({duration:.1f}s)")
        return False
    except Exception as e:
        duration = time.time() - start_time
        print(f"💥 ERROR ({duration:.1f}s): {e}")
        return False

def check_environment():
    """Check if the environment is set up correctly"""
    print("\n🔍 Checking Environment...")
    
    # Check if pytest is installed
    try:
        import pytest
        print("✅ pytest installed")
    except ImportError:
        print("❌ pytest not installed. Run: pip install pytest")
        return False
    
    # Check if required directories exist
    if not os.path.exists('tests'):
        print("❌ tests directory not found")
        return False
    
    if not os.path.exists('tests/ai_agent'):
        print("❌ tests/ai_agent directory not found")
        return False
    
    # Check for test files
    test_files = ['testgen.py', 'testgrade.py', 'testutils.py']
    for test_file in test_files:
        if not os.path.exists(f'tests/ai_agent/{test_file}'):
            print(f"❌ {test_file} not found")
            return False
    
    print("✅ Environment check passed")
    return True

def main():
    """Main test runner function"""
    print_banner()
    
    # Check environment first
    if not check_environment():
        print("\n❌ Environment check failed. Please fix the issues above.")
        sys.exit(1)
    
    # Test suites to run (with full configuration in commands)
    test_suites = [
        {
            "name": "🧠 Question Generation Tests",
            "cmd": ["python", "-m", "pytest", "tests/ai_agent/testgen.py", "-v", "--tb=short", "--color=yes", "--disable-warnings"],
            "description": "Testing AI question generation functionality"
        },
        {
            "name": "📝 Grading & Evaluation Tests",
            "cmd": ["python", "-m", "pytest", "tests/ai_agent/testgrade.py", "-v", "--tb=short", "--color=yes", "--disable-warnings"],
            "description": "Testing AI grading and evaluation features"
        },
        {
            "name": "🔧 Utility Functions Tests",
            "cmd": ["python", "-m", "pytest", "tests/ai_agent/testutils.py", "-v", "--tb=short", "--color=yes", "--disable-warnings"],
            "description": "Testing AI utility and helper functions"
        },
        {
            "name": "📊 All AI Tests (Individual Files)",
            "cmd": ["python", "-m", "pytest", "tests/ai_agent/testgen.py", "tests/ai_agent/testgrade.py", "tests/ai_agent/testutils.py", "-v", "--tb=line", "--color=yes", "--disable-warnings"],
            "description": "Running all AI test files individually"
        },
        {
            "name": "🎯 Coverage Report",
            "cmd": ["python", "-m", "pytest", "tests/ai_agent/testgen.py", "tests/ai_agent/testgrade.py", "tests/ai_agent/testutils.py", "-v", "--color=yes", "--disable-warnings", "--durations=5"],
            "description": "Running all tests with timing report"
        }
    ]
    
    results = []
    total_start_time = time.time()
    
    # Run each test suite
    for i, suite in enumerate(test_suites, 1):
        print(f"\n{'='*60}")
        print(f"📋 Test Suite {i}/{len(test_suites)}: {suite['name']}")
        print(f"📝 {suite['description']}")
        print('='*60)
        
        success = run_command(suite['cmd'], suite['name'])
        results.append({
            'name': suite['name'],
            'success': success
        })
        
        # Short break between test suites
        if i < len(test_suites):
            time.sleep(1)
    
    # Calculate total duration
    total_duration = time.time() - total_start_time
    
    # Print summary
    print("\n" + "="*60)
    print("📊 TEST SUMMARY")
    print("="*60)
    
    passed = 0
    failed = 0
    
    for result in results:
        status = "✅ PASSED" if result['success'] else "❌ FAILED"
        print(f"{status} - {result['name']}")
        
        if result['success']:
            passed += 1
        else:
            failed += 1
    
    print(f"\n📈 Results: {passed} passed, {failed} failed")
    print(f"⏱️  Total time: {total_duration:.1f} seconds")
    print(f"📅 Completed at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Final status
    if failed == 0:
        print("\n🎉 All tests passed! Your AI functionality is working correctly.")
        sys.exit(0)
    else:
        print(f"\n⚠️  {failed} test suite(s) failed. Please check the errors above.")
        sys.exit(1)

def run_specific_test(test_name):
    """Run a specific test file"""
    test_files = {
        'gen': 'tests/ai_agent/testgen.py',
        'grade': 'tests/ai_agent/testgrade.py', 
        'utils': 'tests/ai_agent/testutils.py'
    }
    
    if test_name not in test_files:
        print(f"❌ Unknown test: {test_name}")
        print(f"Available tests: {', '.join(test_files.keys())}")
        sys.exit(1)
    
    cmd = ["python", "-m", "pytest", test_files[test_name], "-v", "--tb=short", "--color=yes", "--disable-warnings"]
    success = run_command(cmd, f"Running {test_name} tests")
    
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    # Check if user wants to run specific test
    if len(sys.argv) > 1:
        test_arg = sys.argv[1].lower()
        if test_arg in ['gen', 'grade', 'utils']:
            run_specific_test(test_arg)
        elif test_arg in ['--help', '-h']:
            print("AI Test Runner Usage:")
            print("  python run_tests.py          # Run all tests")
            print("  python run_tests.py gen      # Run question generation tests")
            print("  python run_tests.py grade    # Run grading tests")
            print("  python run_tests.py utils    # Run utility tests")
            print("  python run_tests.py quick    # Run all tests quickly")
            sys.exit(0)
        elif test_arg == 'quick':
            # Quick run of all tests
            cmd = ["python", "-m", "pytest", "tests/ai_agent/testgen.py", "tests/ai_agent/testgrade.py", "tests/ai_agent/testutils.py", "-v", "--tb=line", "--disable-warnings"]
            success = run_command(cmd, "Quick run of all AI tests")
            sys.exit(0 if success else 1)
        else:
            print(f"❌ Unknown argument: {test_arg}")
            print("Use --help for usage information")
            sys.exit(1)
    
    # Run all tests
    main()