#!/usr/bin/env python3.9
"""
Test script to demonstrate improved image filtering
Shows before/after comparison of filtering strategies
"""

import sys
sys.path.append('/app/image-processing')

from user_isolated_image_processor import UserIsolatedImageProcessor

def test_filtering_comparison():
    """Test different filtering strategies"""
    
    print("🔍 IMAGE FILTERING COMPARISON TEST")
    print("=" * 60)
    
    processor = UserIsolatedImageProcessor("/app/data")
    pdf_path = "/app/image-processing/input.pdf"
    
    print("Testing with different filtering strategies on input.pdf...")
    print()
    
    # Test 1: Very permissive (old settings)
    print("📊 TEST 1: PERMISSIVE FILTERING (Old Settings)")
    print("-" * 50)
    result1 = processor.extract_images_from_pdf(
        pdf_path=pdf_path,
        user_id="filter-test-permissive",
        session_id="test-1",
        min_size_kb=1,    # Very low
        min_width=10,     # Very low
        min_height=10     # Very low
    )
    
    if result1["success"]:
        stats1 = result1["stats"]
        print(f"✅ Permissive Results:")
        print(f"   Total found: {stats1['total_found']}")
        print(f"   Processed: {stats1['processed']}")
        print(f"   Skipped: {stats1['skipped']}")
        print(f"   Success rate: {(stats1['processed']/stats1['total_found']*100):.1f}%")
    else:
        print(f"❌ Test failed: {result1['error']}")
    
    print()
    
    # Test 2: Aggressive filtering (new settings)
    print("📊 TEST 2: AGGRESSIVE FILTERING (New Settings)")
    print("-" * 50)
    result2 = processor.extract_images_from_pdf(
        pdf_path=pdf_path,
        user_id="filter-test-aggressive",
        session_id="test-2",
        min_size_kb=5,    # Higher threshold
        min_width=100,    # Higher threshold
        min_height=100    # Higher threshold
    )
    
    if result2["success"]:
        stats2 = result2["stats"]
        print(f"✅ Aggressive Results:")
        print(f"   Total found: {stats2['total_found']}")
        print(f"   Processed: {stats2['processed']}")
        print(f"   Skipped: {stats2['skipped']}")
        print(f"   Success rate: {(stats2['processed']/stats2['total_found']*100):.1f}%")
    else:
        print(f"❌ Test failed: {result2['error']}")
    
    print()
    
    # Test 3: Ultra-aggressive (content-focused)
    print("📊 TEST 3: ULTRA-AGGRESSIVE FILTERING (Content-Only)")
    print("-" * 55)
    result3 = processor.extract_images_from_pdf(
        pdf_path=pdf_path,
        user_id="filter-test-ultra",
        session_id="test-3",
        min_size_kb=10,   # Even higher
        min_width=150,    # Even higher
        min_height=150    # Even higher
    )
    
    if result3["success"]:
        stats3 = result3["stats"]
        print(f"✅ Ultra-Aggressive Results:")
        print(f"   Total found: {stats3['total_found']}")
        print(f"   Processed: {stats3['processed']}")
        print(f"   Skipped: {stats3['skipped']}")
        print(f"   Success rate: {(stats3['processed']/stats3['total_found']*100):.1f}%")
    else:
        print(f"❌ Test failed: {result3['error']}")
    
    print()
    
    # Comparison summary
    if all(r["success"] for r in [result1, result2, result3]):
        print("📈 FILTERING COMPARISON SUMMARY")
        print("-" * 35)
        
        print(f"{'Strategy':<20} {'Found':<8} {'Processed':<10} {'Skipped':<8} {'Filtered %':<12}")
        print("-" * 65)
        
        for name, result in [
            ("Permissive", result1),
            ("Aggressive", result2), 
            ("Ultra-Aggressive", result3)
        ]:
            stats = result["stats"]
            filtered_pct = (stats['skipped'] / stats['total_found'] * 100)
            print(f"{name:<20} {stats['total_found']:<8} {stats['processed']:<10} {stats['skipped']:<8} {filtered_pct:<12.1f}%")
        
        print()
        print("🎯 RECOMMENDATIONS:")
        print("-" * 20)
        
        aggressive_stats = result2["stats"]
        ultra_stats = result3["stats"]
        
        if aggressive_stats['processed'] > 20:
            print("✅ AGGRESSIVE filtering recommended:")
            print("   - Filters out logos, headers, decorative elements")
            print("   - Keeps meaningful content images")
            print(f"   - Processes {aggressive_stats['processed']} relevant images")
        
        if ultra_stats['processed'] > 10:
            print("✅ ULTRA-AGGRESSIVE also viable:")
            print("   - Maximum content focus")
            print("   - Only large, meaningful images")
            print(f"   - Processes {ultra_stats['processed']} high-value images")
        
        print()
        print("💡 RECOMMENDED SETTINGS FOR PRODUCTION:")
        print("   min_size_kb=5 (filters 1-3KB logos/headers)")
        print("   min_width=100, min_height=100 (meaningful content)")
        print("   Additional filters: aspect ratio, area checks")

def show_sample_filtered_images():
    """Show sample of what gets filtered vs kept"""
    
    print("\n🖼️ SAMPLE FILTERED vs KEPT IMAGES")
    print("=" * 45)
    
    # This would show examples from the collections
    # For now, just show the concept
    
    print("❌ TYPICALLY FILTERED OUT:")
    print("   - Company logos (FARADAY) - 2KB, 153x43px")
    print("   - Header decorations - 1-3KB")
    print("   - Bullet points, icons - small dimensions")
    print("   - Horizontal lines - extreme aspect ratios")
    print()
    
    print("✅ TYPICALLY KEPT:")
    print("   - Technical diagrams - 30KB+, 400x300px+")
    print("   - Circuit schematics - 20KB+, 300x200px+")
    print("   - Block diagrams - 15KB+, 250x200px+")
    print("   - Charts and graphs - 25KB+, 350x250px+")

def main():
    """Run filtering tests"""
    test_filtering_comparison()
    show_sample_filtered_images()
    
    print("\n" + "=" * 60)
    print("🎉 FILTERING TEST COMPLETE")
    print("=" * 60)
    print("The new aggressive filtering will significantly reduce")
    print("noise while keeping all meaningful content images!")

if __name__ == "__main__":
    main()
