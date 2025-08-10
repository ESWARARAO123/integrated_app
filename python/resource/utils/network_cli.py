#!/usr/bin/env python3.12
"""
Network Discovery CLI Tool
Command-line interface for discovering and monitoring multiple servers
"""

import argparse
import sys
import json
import time
from datetime import datetime

try:
    from core.network_discovery import NetworkDiscovery
except ImportError:
    print("Error: NetworkDiscovery module not available")
    sys.exit(1)

class NetworkCLI:
    """Command-line interface for network discovery"""
    
    def __init__(self):
        self.network_discovery = NetworkDiscovery()
    
    def discover(self, network_range: str, username: str, password: str = None, timeout: int = 2):
        """Discover servers in the network"""
        print(f"🔍 Discovering servers in network range: {network_range}")
        print(f"👤 Using username: {username}")
        print("-" * 50)
        
        # Set credentials
        self.network_discovery.set_credentials(username, password)
        
        # Discover servers
        discovered = self.network_discovery.discover_network(network_range, timeout)
        
        if discovered:
            print(f"✅ Found {len(discovered)} servers:")
            for ip in discovered:
                print(f"   📡 {ip}")
        else:
            print("❌ No servers discovered")
        
        return discovered
    
    def check_access(self, servers: list = None):
        """Check SSH accessibility of servers"""
        if not self.network_discovery.discovered_servers:
            print("❌ No servers discovered. Run discovery first.")
            return {}
        
        print("🔐 Checking SSH accessibility...")
        print("-" * 50)
        
        accessible = self.network_discovery.check_server_accessibility(servers)
        
        if accessible:
            print(f"✅ {len(accessible)} servers are accessible:")
            for ip, info in accessible.items():
                status = "✅" if info['accessible'] else "❌"
                error = f" ({info['error']})" if info.get('error') else ""
                print(f"   {status} {ip}{error}")
                if info.get('system_info'):
                    print(f"      System: {info['system_info']}")
        else:
            print("❌ No servers are accessible")
        
        return accessible
    
    def monitor(self, interval: int = 60, duration: int = None):
        """Monitor accessible servers"""
        if not self.network_discovery.accessible_servers:
            print("❌ No accessible servers found. Run discovery and accessibility check first.")
            return
        
        print(f"📊 Starting monitoring of {len(self.network_discovery.accessible_servers)} servers")
        print(f"⏱️  Update interval: {interval} seconds")
        if duration:
            print(f"⏰ Duration: {duration} seconds")
        print("-" * 80)
        
        # Start monitoring
        self.network_discovery.start_monitoring(interval)
        
        start_time = time.time()
        try:
            while True:
                if duration and (time.time() - start_time) > duration:
                    break
                
                # Get current status
                status_data = self.network_discovery.get_all_servers_status()
                self.display_status(status_data)
                
                time.sleep(interval)
                
        except KeyboardInterrupt:
            print("\n🛑 Monitoring stopped by user")
        finally:
            self.network_discovery.stop_monitoring()
    
    def display_status(self, status_data):
        """Display current server status"""
        print(f"\n📊 Server Status - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("-" * 80)
        print(f"{'IP Address':<15} {'CPU %':<8} {'Memory %':<10} {'Disk %':<8} {'Load':<8} {'Status':<10}")
        print("-" * 80)
        
        server_status = status_data.get('server_status', {})
        
        for ip, status in server_status.items():
            cpu = f"{status.get('cpu_usage', 0):.1f}"
            memory = f"{status.get('memory_usage', {}).get('percent', 0):.1f}"
            disk = f"{status.get('disk_usage', {}).get('percent', 0)}"
            load = f"{status.get('load_average', [0, 0, 0])[0]:.2f}"
            
            # Color coding based on usage
            cpu_color = "🟢" if status.get('cpu_usage', 0) < 80 else "🟡" if status.get('cpu_usage', 0) < 90 else "🔴"
            mem_color = "🟢" if status.get('memory_usage', {}).get('percent', 0) < 80 else "🟡" if status.get('memory_usage', {}).get('percent', 0) < 90 else "🔴"
            
            print(f"{ip:<15} {cpu_color}{cpu:<7} {mem_color}{memory:<9} {disk:<8} {load:<8} {'Online':<10}")
        
        print("-" * 80)
        print(f"Total servers: {len(server_status)}")
    
    def get_status(self, ip: str = None):
        """Get status of specific server or all servers"""
        if ip:
            if ip not in self.network_discovery.accessible_servers:
                print(f"❌ Server {ip} is not accessible")
                return
            
            status = self.network_discovery.get_server_status(ip)
            if status:
                self.display_detailed_status(ip, status)
            else:
                print(f"❌ Could not get status for {ip}")
        else:
            status_data = self.network_discovery.get_all_servers_status()
            self.display_status(status_data)
    
    def display_detailed_status(self, ip: str, status: dict):
        """Display detailed status of a specific server"""
        print(f"📊 Detailed Status for {ip}")
        print("=" * 50)
        print(f"Timestamp: {status.get('timestamp', 'Unknown')}")
        print(f"CPU Usage: {status.get('cpu_usage', 0):.1f}%")
        
        memory = status.get('memory_usage', {})
        print(f"Memory Usage: {memory.get('percent', 0):.1f}% ({memory.get('used_mb', 0)}/{memory.get('total_mb', 0)} MB)")
        
        disk = status.get('disk_usage', {})
        print(f"Disk Usage: {disk.get('percent', 0)}% ({disk.get('used', 'Unknown')}/{disk.get('total', 'Unknown')})")
        
        load_avg = status.get('load_average', [0, 0, 0])
        print(f"Load Average: {load_avg[0]:.2f}, {load_avg[1]:.2f}, {load_avg[2]:.2f}")
        print(f"Uptime: {status.get('uptime', 'Unknown')}")
    
    def export(self, filename: str = None):
        """Export discovery and monitoring results"""
        try:
            exported_file = self.network_discovery.export_results(filename)
            print(f"✅ Results exported to: {exported_file}")
        except Exception as e:
            print(f"❌ Export failed: {e}")
    
    def list_servers(self):
        """List all discovered and accessible servers"""
        print("📋 Server Summary")
        print("=" * 30)
        print(f"Discovered servers: {len(self.network_discovery.discovered_servers)}")
        print(f"Accessible servers: {len(self.network_discovery.accessible_servers)}")
        
        if self.network_discovery.discovered_servers:
            print("\n🔍 Discovered Servers:")
            for ip in self.network_discovery.discovered_servers:
                status = "✅ Accessible" if ip in self.network_discovery.accessible_servers else "❌ Not Accessible"
                print(f"   {ip} - {status}")
        
        if self.network_discovery.accessible_servers:
            print("\n🔐 Accessible Servers:")
            for ip, info in self.network_discovery.accessible_servers.items():
                system_info = info.get('system_info', 'Unknown')
                print(f"   {ip} - {system_info}")

def main():
    """Main CLI function"""
    parser = argparse.ArgumentParser(
        description='Network Discovery and Multi-Server Monitoring CLI',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Discover servers in network
  python network_cli.py discover --range 192.168.2.0/24 --username root
  
  # Check SSH accessibility
  python network_cli.py check-access --username root
  
  # Monitor servers for 5 minutes
  python network_cli.py monitor --interval 30 --duration 300
  
  # Get status of specific server
  python network_cli.py status --ip 192.168.2.111
  
  # Export results
  python network_cli.py export --filename results.json
        """
    )
    
    subparsers = parser.add_subparsers(dest='command', help='Available commands')
    
    # Discover command
    discover_parser = subparsers.add_parser('discover', help='Discover servers in network')
    discover_parser.add_argument('--range', default='192.168.2.0/24', help='Network range to scan')
    discover_parser.add_argument('--username', required=True, help='SSH username')
    discover_parser.add_argument('--password', help='SSH password')
    discover_parser.add_argument('--timeout', type=int, default=2, help='Ping timeout in seconds')
    
    # Check access command
    check_parser = subparsers.add_parser('check-access', help='Check SSH accessibility')
    check_parser.add_argument('--username', required=True, help='SSH username')
    check_parser.add_argument('--password', help='SSH password')
    
    # Monitor command
    monitor_parser = subparsers.add_parser('monitor', help='Monitor accessible servers')
    monitor_parser.add_argument('--interval', type=int, default=60, help='Update interval in seconds')
    monitor_parser.add_argument('--duration', type=int, help='Monitoring duration in seconds')
    
    # Status command
    status_parser = subparsers.add_parser('status', help='Get server status')
    status_parser.add_argument('--ip', help='Specific IP address')
    
    # Export command
    export_parser = subparsers.add_parser('export', help='Export results')
    export_parser.add_argument('--filename', help='Output filename')
    
    # List command
    list_parser = subparsers.add_parser('list', help='List discovered and accessible servers')
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return
    
    cli = NetworkCLI()
    
    try:
        if args.command == 'discover':
            cli.discover(args.range, args.username, args.password, args.timeout)
        
        elif args.command == 'check-access':
            cli.network_discovery.set_credentials(args.username, args.password)
            cli.check_access()
        
        elif args.command == 'monitor':
            cli.monitor(args.interval, args.duration)
        
        elif args.command == 'status':
            cli.get_status(args.ip)
        
        elif args.command == 'export':
            cli.export(args.filename)
        
        elif args.command == 'list':
            cli.list_servers()
    
    except KeyboardInterrupt:
        print("\n👋 Operation cancelled by user")
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main() 