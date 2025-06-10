#!/usr/bin/env python3.9
"""
Cleanup Script for Image Collections
Deletes user image collections from filesystem and provides ChromaDB cleanup info
"""

import os
import sys
import json
import shutil
import argparse
from pathlib import Path
from datetime import datetime

class ImageCollectionCleaner:
    def __init__(self, base_data_dir="/app/data"):
        self.base_data_dir = Path(base_data_dir)
        self.collections_dir = self.base_data_dir / "collections"
    
    def list_image_collections(self):
        """List all user image collections"""
        collections = []
        
        if not self.collections_dir.exists():
            print("📁 No collections directory found")
            return collections
        
        try:
            for entry in self.collections_dir.iterdir():
                if entry.is_dir() and "_images" in entry.name:
                    info = self.get_collection_info(entry)
                    collections.append({
                        "name": entry.name,
                        "path": str(entry),
                        **info
                    })
            
            return collections
        except Exception as e:
            print(f"❌ Error listing collections: {e}")
            return []
    
    def get_collection_info(self, collection_path):
        """Get information about a collection"""
        try:
            sessions = []
            total_images = 0
            total_size = 0
            
            for entry in collection_path.iterdir():
                if entry.is_dir():
                    session_info = self.get_session_info(entry)
                    sessions.append({
                        "name": entry.name,
                        "path": str(entry),
                        **session_info
                    })
                    total_images += session_info["image_count"]
                    total_size += session_info["total_size"]
            
            return {
                "sessions": sessions,
                "total_images": total_images,
                "total_size_kb": round(total_size / 1024),
                "last_modified": collection_path.stat().st_mtime
            }
        except Exception as e:
            return {
                "sessions": [],
                "total_images": 0,
                "total_size_kb": 0,
                "error": str(e)
            }
    
    def get_session_info(self, session_path):
        """Get information about a session"""
        try:
            image_count = 0
            total_size = 0
            metadata_file = None
            
            for entry in session_path.iterdir():
                if entry.name == "collection_metadata.json":
                    metadata_file = entry
                elif entry.name.startswith("img_"):
                    image_count += 1
                    total_size += entry.stat().st_size
            
            metadata = None
            if metadata_file and metadata_file.exists():
                try:
                    with open(metadata_file, 'r') as f:
                        metadata = json.load(f)
                except Exception as e:
                    print(f"⚠️ Could not read metadata: {e}")
            
            return {
                "image_count": image_count,
                "total_size": total_size,
                "metadata": metadata,
                "last_modified": session_path.stat().st_mtime
            }
        except Exception as e:
            return {
                "image_count": 0,
                "total_size": 0,
                "metadata": None,
                "error": str(e)
            }
    
    def delete_user_collection(self, user_id, session_id=None):
        """Delete a specific user's image collection"""
        try:
            print(f"🗑️ Deleting collection for user: {user_id}{f', session: {session_id}' if session_id else ''}")
            
            user_collection_name = f"user_{user_id.replace('-', '_')}_images"
            user_collection_path = self.collections_dir / user_collection_name
            
            if not user_collection_path.exists():
                print(f"📁 Collection not found: {user_collection_name}")
                return {"success": False, "message": "Collection not found"}
            
            if session_id:
                # Delete specific session
                session_name = f"session_{session_id.replace('-', '_')}"
                session_path = user_collection_path / session_name
                
                if session_path.exists():
                    shutil.rmtree(session_path)
                    print(f"✅ Deleted session: {session_name}")
                    
                    # Check if user collection is now empty
                    remaining_sessions = list(user_collection_path.iterdir())
                    if not remaining_sessions:
                        shutil.rmtree(user_collection_path)
                        print(f"✅ Deleted empty user collection: {user_collection_name}")
                else:
                    print(f"📁 Session not found: {session_name}")
                    return {"success": False, "message": "Session not found"}
            else:
                # Delete entire user collection
                shutil.rmtree(user_collection_path)
                print(f"✅ Deleted user collection: {user_collection_name}")
            
            return {"success": True, "message": "Collection deleted successfully"}
        except Exception as e:
            print(f"❌ Error deleting collection: {e}")
            return {"success": False, "error": str(e)}
    
    def delete_all_image_collections(self):
        """Delete all image collections"""
        try:
            print("🗑️ Deleting ALL image collections...")
            
            collections = self.list_image_collections()
            
            if not collections:
                print("📁 No image collections found")
                return {"success": True, "message": "No collections to delete"}
            
            deleted_count = 0
            for collection in collections:
                try:
                    shutil.rmtree(collection["path"])
                    print(f"✅ Deleted: {collection['name']}")
                    deleted_count += 1
                except Exception as e:
                    print(f"❌ Failed to delete {collection['name']}: {e}")
            
            print(f"🎯 Deleted {deleted_count} out of {len(collections)} collections")
            return {"success": True, "deleted_count": deleted_count, "total_count": len(collections)}
        except Exception as e:
            print(f"❌ Error deleting all collections: {e}")
            return {"success": False, "error": str(e)}
    
    def display_collections_summary(self):
        """Display collections summary"""
        print("📊 IMAGE COLLECTIONS SUMMARY")
        print("=" * 40)
        
        collections = self.list_image_collections()
        
        if not collections:
            print("📁 No image collections found")
            return
        
        total_images = 0
        total_size = 0
        
        for collection in collections:
            print(f"\n👤 {collection['name']}")
            print(f"   📁 Path: {collection['path']}")
            print(f"   🖼️ Images: {collection['total_images']}")
            print(f"   💾 Size: {collection['total_size_kb']}KB")
            
            # Convert timestamp to readable date
            last_modified = datetime.fromtimestamp(collection['last_modified'])
            print(f"   📅 Modified: {last_modified.strftime('%Y-%m-%d %H:%M:%S')}")
            
            if collection['sessions']:
                print("   📂 Sessions:")
                for session in collection['sessions']:
                    size_kb = round(session['total_size'] / 1024)
                    print(f"      - {session['name']}: {session['image_count']} images ({size_kb}KB)")
                    
                    # Show metadata if available
                    if session['metadata']:
                        meta = session['metadata']
                        if 'pdf_source' in meta:
                            print(f"        📄 Source: {meta['pdf_source']}")
                        if 'created_at' in meta:
                            print(f"        📅 Created: {meta['created_at']}")
            
            total_images += collection['total_images']
            total_size += collection['total_size_kb']
        
        print(f"\n📈 TOTALS:")
        print(f"   Collections: {len(collections)}")
        print(f"   Total Images: {total_images}")
        print(f"   Total Size: {total_size}KB")
    
    def show_keywords_summary(self):
        """Show keywords from all collections"""
        print("🔤 KEYWORDS SUMMARY FROM ALL COLLECTIONS")
        print("=" * 50)
        
        collections = self.list_image_collections()
        all_keywords = []
        
        for collection in collections:
            for session in collection['sessions']:
                if session['metadata'] and 'images' in session['metadata']:
                    for img in session['metadata']['images']:
                        keywords = img.get('keywords', '')
                        if keywords and 'Page ' not in keywords:  # Skip fallback keywords
                            all_keywords.append({
                                'user': collection['name'],
                                'session': session['name'],
                                'page': img.get('page', 'N/A'),
                                'filename': img.get('filename', 'N/A'),
                                'keywords': keywords
                            })
        
        if not all_keywords:
            print("📁 No keywords found in collections")
            return
        
        print(f"Found {len(all_keywords)} images with OCR keywords:")
        print()
        
        for i, item in enumerate(all_keywords[:20], 1):  # Show first 20
            print(f"{i:2d}. {item['user']} | {item['session']} | Page {item['page']} | {item['keywords'][:80]}...")
        
        if len(all_keywords) > 20:
            print(f"\n... and {len(all_keywords) - 20} more images with keywords")


def main():
    """Main CLI function"""
    parser = argparse.ArgumentParser(description="Image Collection Cleanup Tool")
    parser.add_argument("command", choices=["list", "delete-user", "delete-session", "delete-all", "keywords"], 
                       help="Command to execute")
    parser.add_argument("--user-id", help="User ID for delete-user and delete-session commands")
    parser.add_argument("--session-id", help="Session ID for delete-session command")
    parser.add_argument("--data-dir", default="/app/data", help="Base data directory")
    
    if len(sys.argv) == 1:
        print("🧹 Image Collection Cleanup Tool")
        print("================================")
        print("Usage:")
        print("  python cleanup_image_collections.py list                           # List all collections")
        print("  python cleanup_image_collections.py delete-user --user-id <userId> # Delete user collection")
        print("  python cleanup_image_collections.py delete-session --user-id <userId> --session-id <sessionId>")
        print("  python cleanup_image_collections.py delete-all                     # Delete all collections")
        print("  python cleanup_image_collections.py keywords                       # Show all extracted keywords")
        return
    
    args = parser.parse_args()
    cleaner = ImageCollectionCleaner(args.data_dir)
    
    if args.command == "list":
        cleaner.display_collections_summary()
    
    elif args.command == "delete-user":
        if not args.user_id:
            print("❌ --user-id is required for delete-user command")
            sys.exit(1)
        result = cleaner.delete_user_collection(args.user_id)
        print("✅ Success" if result["success"] else "❌ Failed:", result.get("message", result.get("error")))
    
    elif args.command == "delete-session":
        if not args.user_id or not args.session_id:
            print("❌ Both --user-id and --session-id are required for delete-session command")
            sys.exit(1)
        result = cleaner.delete_user_collection(args.user_id, args.session_id)
        print("✅ Success" if result["success"] else "❌ Failed:", result.get("message", result.get("error")))
    
    elif args.command == "delete-all":
        result = cleaner.delete_all_image_collections()
        print("✅ Success" if result["success"] else "❌ Failed:", result.get("message", result.get("error")))
    
    elif args.command == "keywords":
        cleaner.show_keywords_summary()


if __name__ == "__main__":
    main()
